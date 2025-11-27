import { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * Semi-Private Training Rescheduling API
 *
 * Allows parents to reschedule their semi-private training sessions with intelligent pairing:
 * - One-time: Change for a specific date only
 * - Permanent: Change ongoing schedule
 *
 * Business Rules:
 * - Available 7 days a week
 * - Available times: 8 AM - 3 PM (7 hourly slots)
 * - When player reschedules, pairing status may change
 * - Show "Suggested Times" where unpaired players exist in same age group
 * - Auto-pair when two players choose same slot
 * - Notify partner when pairing dissolves
 */

const AVAILABLE_DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
const AVAILABLE_TIME_SLOTS = ['8-9', '9-10', '10-11', '11-12', '12-13', '13-14', '14-15'];

interface ExceptionMapping {
  originalDay: string;
  replacementDay: string;
  date: string; // The date of the original day
}

interface RescheduleRequest {
  action: 'get_suggested_times' | 'get_availability' | 'check_availability' | 'reschedule' | 'get_current_pairing';
  registrationId: string;
  firebaseUid: string;
  changeType?: 'one_time' | 'permanent';
  newDay?: string;
  newTime?: string;
  specificDate?: string;
  effectiveDate?: string;
  exceptionMappings?: ExceptionMapping[]; // Detailed mappings for one-time changes
  reason?: string;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const {
      action,
      registrationId,
      firebaseUid,
      changeType,
      newDay,
      newTime,
      specificDate,
      effectiveDate,
      exceptionMappings,
      reason
    } = req.body as RescheduleRequest;

    // Validate registration ownership
    const { data: registration, error: regError } = await supabase
      .from('registrations')
      .select('*')
      .eq('id', registrationId)
      .eq('firebase_uid', firebaseUid)
      .single();

    if (regError || !registration) {
      return res.status(404).json({
        success: false,
        error: 'Registration not found or unauthorized'
      });
    }

    // Verify it's a semi-private training registration
    if (registration.form_data?.programType !== 'semi-private') {
      return res.status(400).json({
        success: false,
        error: 'This endpoint is only for Semi-Private Training rescheduling'
      });
    }

    const playerCategory = registration.form_data?.playerCategory;
    const playerName = registration.form_data?.playerFullName;

    if (action === 'get_current_pairing') {
      // Get current pairing info
      const { data: pairing } = await supabase
        .from('semi_private_pairings')
        .select(`
          *,
          player_1:player_1_registration_id(form_data),
          player_2:player_2_registration_id(form_data)
        `)
        .or(`player_1_registration_id.eq.${registrationId},player_2_registration_id.eq.${registrationId}`)
        .eq('status', 'active')
        .single();

      if (!pairing) {
        return res.status(200).json({
          success: true,
          paired: false,
          message: 'You are currently not paired with a partner'
        });
      }

      // Determine which player is the partner
      const isPlayer1 = pairing.player_1_registration_id === registrationId;
      const partnerData = isPlayer1 ? pairing.player_2 : pairing.player_1;

      return res.status(200).json({
        success: true,
        paired: true,
        pairing: {
          id: pairing.id,
          partnerName: partnerData?.form_data?.playerFullName,
          partnerCategory: partnerData?.form_data?.playerCategory,
          scheduledDay: pairing.scheduled_day,
          scheduledTime: pairing.scheduled_time,
          pairedDate: pairing.paired_date
        }
      });
    }

    if (action === 'get_suggested_times') {
      // Get times where unpaired players exist in same age category
      const { data: unpairedPlayers } = await supabase
        .from('unpaired_semi_private')
        .select('*')
        .eq('age_category', playerCategory)
        .eq('status', 'waiting')
        .neq('registration_id', registrationId);

      if (!unpairedPlayers || unpairedPlayers.length === 0) {
        return res.status(200).json({
          success: true,
          suggestedTimes: [],
          message: 'No unpaired players in your age category at the moment'
        });
      }

      // Build suggested times from unpaired players' preferences
      const suggestedTimes = unpairedPlayers.flatMap(player => {
        const suggestions = [];
        for (const day of player.preferred_days || []) {
          for (const time of player.preferred_time_slots || []) {
            suggestions.push({
              day,
              time,
              partnerName: player.player_name,
              partnerCategory: player.age_category,
              unpairedSince: player.unpaired_since_date
            });
          }
        }
        return suggestions;
      });

      return res.status(200).json({
        success: true,
        suggestedTimes,
        totalUnpairedPlayers: unpairedPlayers.length
      });
    }

    if (action === 'get_availability') {
      // Get full week availability grid with pairing opportunities
      const { data: unpairedPlayers } = await supabase
        .from('unpaired_semi_private')
        .select('*')
        .eq('age_category', playerCategory)
        .eq('status', 'waiting')
        .neq('registration_id', registrationId);

      const weekAvailability = await Promise.all(
        AVAILABLE_DAYS.map(async (day) => {
          const daySlots = await Promise.all(
            AVAILABLE_TIME_SLOTS.map(async (time) => {
              // Check if this specific slot is booked
              const { data: bookings } = await supabase
                .from('registrations')
                .select('form_data, id')
                .in('payment_status', ['succeeded', 'verified'])
                .or(`form_data->programType.eq.private,form_data->programType.eq.semi-private`);

              const bookedCount = bookings?.filter(b => {
                const isPrivate = b.form_data?.programType === 'private';
                const isSemiPrivate = b.form_data?.programType === 'semi-private';

                if (isPrivate) {
                  return b.form_data?.privateSelectedDays?.includes(day) &&
                         b.form_data?.privateTimeSlot === time;
                }

                if (isSemiPrivate) {
                  // Check both semiPrivateTimeSlot (string) and semiPrivateTimeWindows (array)
                  const semiTime = b.form_data?.semiPrivateTimeSlot ||
                    (b.form_data?.semiPrivateTimeWindows && b.form_data?.semiPrivateTimeWindows[0]);
                  const semiDays = b.form_data?.semiPrivateAvailability || [];
                  return semiDays.includes(day) && semiTime === time;
                }

                return false;
              }).length || 0;

              // Check if there's an unpaired player at this time
              const hasUnpairedPartner = unpairedPlayers?.some(p =>
                p.preferred_days?.includes(day) && p.preferred_time_slots?.includes(time)
              );

              const partner = unpairedPlayers?.find(p =>
                p.preferred_days?.includes(day) && p.preferred_time_slots?.includes(time)
              );

              // Check if this is the current slot
              const currentSemiTime = registration.form_data?.semiPrivateTimeSlot ||
                (registration.form_data?.semiPrivateTimeWindows && registration.form_data?.semiPrivateTimeWindows[0]);
              const currentSemiDays = registration.form_data?.semiPrivateAvailability || [];

              return {
                time,
                available: bookedCount === 0,
                hasUnpairedPartner,
                partnerName: partner?.player_name,
                isCurrent: currentSemiDays.includes(day) && currentSemiTime === time,
                priority: hasUnpairedPartner ? 'high' : 'normal' // Prioritize slots with partners
              };
            })
          );

          return {
            day,
            slots: daySlots
          };
        })
      );

      // Get current time slot (handle both field names)
      const currentTimeSlot = registration.form_data?.semiPrivateTimeSlot ||
        (registration.form_data?.semiPrivateTimeWindows && registration.form_data?.semiPrivateTimeWindows[0]) ||
        null;

      return res.status(200).json({
        success: true,
        availability: weekAvailability,
        currentSchedule: {
          days: registration.form_data?.semiPrivateAvailability || [],
          timeSlot: currentTimeSlot
        }
      });
    }

    if (action === 'check_availability') {
      if (!newDay || !newTime) {
        return res.status(400).json({
          success: false,
          error: 'Please provide newDay and newTime'
        });
      }

      // Check if slot is available
      const { data: bookings } = await supabase
        .from('registrations')
        .select('form_data, id')
        .in('payment_status', ['succeeded', 'verified'])
        .or(`form_data->programType.eq.private,form_data->programType.eq.semi-private`);

      // Exclude current registration from conflict check
      const isBooked = bookings?.some(b => {
        if (b.id === registrationId) return false;

        const isPrivate = b.form_data?.programType === 'private';
        const isSemiPrivate = b.form_data?.programType === 'semi-private';

        if (isPrivate) {
          return b.form_data?.privateSelectedDays?.includes(newDay.toLowerCase()) &&
                 b.form_data?.privateTimeSlot === newTime;
        }

        if (isSemiPrivate) {
          // Check both semiPrivateTimeSlot (string) and semiPrivateTimeWindows (array)
          const semiTime = b.form_data?.semiPrivateTimeSlot ||
            (b.form_data?.semiPrivateTimeWindows && b.form_data?.semiPrivateTimeWindows[0]);
          const semiDays = b.form_data?.semiPrivateAvailability || [];
          return semiDays.includes(newDay.toLowerCase()) && semiTime === newTime;
        }

        return false;
      });

      // Check for unpaired partners at this time
      const { data: unpairedPartner } = await supabase
        .from('unpaired_semi_private')
        .select('*')
        .eq('age_category', playerCategory)
        .eq('status', 'waiting')
        .neq('registration_id', registrationId)
        .contains('preferred_days', [newDay.toLowerCase()])
        .contains('preferred_time_slots', [newTime])
        .limit(1)
        .single();

      return res.status(200).json({
        success: true,
        available: !isBooked,
        day: newDay,
        time: newTime,
        hasUnpairedPartner: !!unpairedPartner,
        partnerInfo: unpairedPartner ? {
          name: unpairedPartner.player_name,
          category: unpairedPartner.age_category
        } : null,
        message: isBooked
          ? 'This time slot is already booked'
          : unpairedPartner
            ? `Available! Partner waiting: ${unpairedPartner.player_name}`
            : 'Available (no partner at this time yet)'
      });
    }

    if (action === 'reschedule') {
      if (!changeType || !newDay || !newTime) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields: changeType, newDay, newTime'
        });
      }

      // Check if slot is available
      const { data: bookings } = await supabase
        .from('registrations')
        .select('form_data, id')
        .in('payment_status', ['succeeded', 'verified'])
        .or(`form_data->programType.eq.private,form_data->programType.eq.semi-private`);

      const isBooked = bookings?.some(b => {
        if (b.id === registrationId) return false;

        const isPrivate = b.form_data?.programType === 'private';
        const isSemiPrivate = b.form_data?.programType === 'semi-private';

        if (isPrivate) {
          return b.form_data?.privateSelectedDays?.includes(newDay.toLowerCase()) &&
                 b.form_data?.privateTimeSlot === newTime;
        }

        if (isSemiPrivate) {
          // Check both semiPrivateTimeSlot (string) and semiPrivateTimeWindows (array)
          const semiTime = b.form_data?.semiPrivateTimeSlot ||
            (b.form_data?.semiPrivateTimeWindows && b.form_data?.semiPrivateTimeWindows[0]);
          const semiDays = b.form_data?.semiPrivateAvailability || [];
          return semiDays.includes(newDay.toLowerCase()) && semiTime === newTime;
        }

        return false;
      });

      if (isBooked) {
        return res.status(400).json({
          success: false,
          error: 'This time slot is already booked. Please choose another time.'
        });
      }

      // Step 1: Check if player has existing pairing and dissolve it
      const { data: existingPairing } = await supabase
        .from('semi_private_pairings')
        .select('*')
        .or(`player_1_registration_id.eq.${registrationId},player_2_registration_id.eq.${registrationId}`)
        .eq('status', 'active')
        .single();

      let dissolvedPartnerInfo = null;

      if (existingPairing) {
        // Dissolve the pairing
        await supabase
          .from('semi_private_pairings')
          .update({
            status: 'dissolved',
            dissolved_date: new Date().toISOString().split('T')[0],
            dissolved_reason: `Player rescheduled to ${newDay} at ${newTime}`,
            dissolved_by: firebaseUid
          })
          .eq('id', existingPairing.id);

        // Get partner info for notification
        const partnerId = existingPairing.player_1_registration_id === registrationId
          ? existingPairing.player_2_registration_id
          : existingPairing.player_1_registration_id;

        const { data: partnerReg } = await supabase
          .from('registrations')
          .select('form_data')
          .eq('id', partnerId)
          .single();

        if (partnerReg) {
          dissolvedPartnerInfo = {
            id: partnerId,
            name: partnerReg.form_data?.playerFullName,
            email: partnerReg.form_data?.parentEmail
          };

          // Add partner to unpaired list
          await supabase
            .from('unpaired_semi_private')
            .upsert({
              registration_id: partnerId,
              player_name: partnerReg.form_data?.playerFullName,
              player_category: partnerReg.form_data?.playerCategory,
              age_category: partnerReg.form_data?.playerCategory,
              preferred_days: [existingPairing.scheduled_day],
              preferred_time_slots: [existingPairing.scheduled_time],
              parent_email: partnerReg.form_data?.parentEmail,
              parent_name: partnerReg.form_data?.parentFullName,
              status: 'waiting',
              unpaired_since_date: new Date().toISOString().split('T')[0]
            }, {
              onConflict: 'registration_id'
            });
        }
      }

      // Step 2: Try to find a new partner at the new time/day
      const { data: potentialPartner } = await supabase
        .from('unpaired_semi_private')
        .select('*')
        .eq('age_category', playerCategory)
        .eq('status', 'waiting')
        .neq('registration_id', registrationId)
        .contains('preferred_days', [newDay.toLowerCase()])
        .contains('preferred_time_slots', [newTime])
        .limit(1)
        .single();

      let newPairingInfo = null;

      if (potentialPartner) {
        // Create new pairing
        const { data: newPairing } = await supabase
          .from('semi_private_pairings')
          .insert({
            player_1_registration_id: registrationId,
            player_2_registration_id: potentialPartner.registration_id,
            scheduled_day: newDay.toLowerCase(),
            scheduled_time: newTime,
            status: 'active'
          })
          .select()
          .single();

        // Update both players' unpaired status
        await supabase
          .from('unpaired_semi_private')
          .update({
            status: 'paired',
            paired_date: new Date().toISOString().split('T')[0]
          })
          .in('registration_id', [registrationId, potentialPartner.registration_id]);

        newPairingInfo = {
          id: newPairing?.id,
          partnerName: potentialPartner.player_name,
          partnerCategory: potentialPartner.age_category
        };
      } else {
        // No partner found, add to unpaired list
        await supabase
          .from('unpaired_semi_private')
          .upsert({
            registration_id: registrationId,
            player_name: playerName,
            player_category: playerCategory,
            age_category: playerCategory,
            preferred_days: [newDay.toLowerCase()],
            preferred_time_slots: [newTime],
            parent_email: registration.form_data?.parentEmail,
            parent_name: registration.form_data?.parentFullName,
            status: 'waiting',
            unpaired_since_date: new Date().toISOString().split('T')[0]
          }, {
            onConflict: 'registration_id'
          });
      }

      // Get original time (handle both field names)
      const originalTime = registration.form_data?.semiPrivateTimeSlot ||
        (registration.form_data?.semiPrivateTimeWindows && registration.form_data?.semiPrivateTimeWindows[0]) ||
        null;

      // Step 3: Create schedule change record
      const { data: scheduleChange } = await supabase
        .from('schedule_changes')
        .insert({
          registration_id: registrationId,
          change_type: changeType,
          program_type: 'semi_private',
          original_days: registration.form_data?.semiPrivateAvailability || [],
          original_time: originalTime,
          new_days: [newDay.toLowerCase()],
          new_time: newTime,
          specific_date: changeType === 'one_time' ? specificDate : null,
          effective_date: changeType === 'permanent' ? effectiveDate || new Date().toISOString().split('T')[0] : null,
          status: 'approved',
          reason,
          created_by: firebaseUid,
          approved_at: new Date().toISOString(),
          approved_by: 'system',
          applied_at: new Date().toISOString()
        })
        .select()
        .single();

      // Step 4: For permanent changes, update registration
      if (changeType === 'permanent') {
        const updatedFormData = {
          ...registration.form_data,
          semiPrivateAvailability: [newDay.toLowerCase()],
          semiPrivateTimeSlot: newTime
        };

        await supabase
          .from('registrations')
          .update({
            form_data: updatedFormData,
            updated_at: new Date().toISOString()
          })
          .eq('id', registrationId);
      }

      // Step 5: For one-time changes, create exception(s)
      if (changeType === 'one_time') {
        console.log('Creating one-time semi-private exceptions...');
        console.log('- exceptionMappings:', JSON.stringify(exceptionMappings));
        console.log('- specificDate:', specificDate);
        console.log('- newDay:', newDay);

        // Use detailed mappings if provided (same approach as private training)
        if (exceptionMappings && exceptionMappings.length > 0) {
          for (const mapping of exceptionMappings) {
            console.log(`Creating exception: ${mapping.originalDay} (${mapping.date}) -> ${mapping.replacementDay}`);

            const { error: exceptionError } = await supabase
              .from('schedule_exceptions')
              .insert({
                registration_id: registrationId,
                exception_date: mapping.date, // Date of the ORIGINAL day
                exception_type: 'swap',
                replacement_day: mapping.replacementDay.toLowerCase(),
                replacement_time: newTime,
                status: 'applied',
                reason: reason || `One-time swap: ${mapping.originalDay} -> ${mapping.replacementDay}`,
                created_by: firebaseUid,
                applied_at: new Date().toISOString()
              });

            if (exceptionError) {
              console.error('Error creating exception:', exceptionError);
            } else {
              console.log('Exception created successfully!');
            }
          }
        } else if (specificDate) {
          // Fallback: old behavior for backwards compatibility
          console.log('Using legacy exception creation (no mappings provided)');
          await supabase
            .from('schedule_exceptions')
            .insert({
              registration_id: registrationId,
              exception_date: specificDate,
              exception_type: 'swap',
              replacement_day: newDay.toLowerCase(),
              replacement_time: newTime,
              status: 'applied',
              reason,
              created_by: firebaseUid,
              applied_at: new Date().toISOString()
            });
        }
      }

      return res.status(200).json({
        success: true,
        message: changeType === 'permanent'
          ? 'Your schedule has been permanently updated'
          : 'Your one-time schedule change has been applied',
        scheduleChange,
        newSchedule: {
          day: newDay,
          time: newTime
        },
        pairingStatus: {
          hadPreviousPartner: !!existingPairing,
          previousPartner: dissolvedPartnerInfo,
          newPartner: newPairingInfo,
          isPaired: !!newPairingInfo,
          isWaiting: !newPairingInfo
        },
        notifications: {
          notifyPreviousPartner: !!dissolvedPartnerInfo,
          notifyNewPartner: !!newPairingInfo
        }
      });
    }

    return res.status(400).json({
      success: false,
      error: 'Invalid action'
    });

  } catch (error) {
    console.error('Error in reschedule-semi-private:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
