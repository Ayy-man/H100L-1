import { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * Private Training Rescheduling API
 *
 * Allows parents to reschedule their private training sessions:
 * - One-time: Change for a specific date only
 * - Permanent: Change ongoing schedule
 *
 * Business Rules:
 * - Available 7 days a week
 * - Available times: 8 AM - 3 PM (7 hourly slots)
 * - Hourly slots: 8-9, 9-10, 10-11, 11-12, 12-1, 1-2, 2-3
 * - Must check for conflicts with existing bookings
 * - Max 1 booking per specific time/day combination
 */

const AVAILABLE_DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
const AVAILABLE_TIME_SLOTS = ['8-9', '9-10', '10-11', '11-12', '12-13', '13-14', '14-15'];

interface RescheduleRequest {
  action: 'check_availability' | 'get_availability' | 'reschedule';
  registrationId: string;
  firebaseUid: string;
  changeType?: 'one_time' | 'permanent';
  newDay?: string;
  newTime?: string; // e.g., '9:00 AM'
  specificDate?: string; // For one-time changes
  effectiveDate?: string; // For permanent changes
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

    // Verify it's a private training registration
    if (registration.form_data?.programType !== 'private') {
      return res.status(400).json({
        success: false,
        error: 'This endpoint is only for Private Training rescheduling'
      });
    }

    if (action === 'get_availability') {
      // Get full week availability grid
      const weekAvailability = await Promise.all(
        AVAILABLE_DAYS.map(async (day) => {
          const daySlots = await Promise.all(
            AVAILABLE_TIME_SLOTS.map(async (time) => {
              // Check if this specific slot is booked
              const { data: bookings, error } = await supabase
                .from('registrations')
                .select('form_data')
                .eq('payment_status', 'active')
                .or(`form_data->programType.eq.private,form_data->programType.eq.semi-private`);

              if (error) {
                console.error('Error checking availability:', error);
                return {
                  time,
                  available: false,
                  error: 'Failed to check availability'
                };
              }

              // Count bookings for this specific day and time
              const bookedCount = bookings?.filter(b => {
                const isPrivate = b.form_data?.programType === 'private';
                const isSemiPrivate = b.form_data?.programType === 'semi-private';

                if (isPrivate) {
                  return b.form_data?.privateSelectedDays?.includes(day) &&
                         b.form_data?.privateTimeSlot === time;
                }

                if (isSemiPrivate) {
                  return b.form_data?.semiPrivateAvailability?.includes(day) &&
                         b.form_data?.semiPrivateTimeSlot === time;
                }

                return false;
              }).length || 0;

              return {
                time,
                available: bookedCount === 0,
                isCurrent: registration.form_data?.privateSelectedDays?.includes(day) &&
                          registration.form_data?.privateTimeSlot === time
              };
            })
          );

          return {
            day,
            slots: daySlots
          };
        })
      );

      return res.status(200).json({
        success: true,
        availability: weekAvailability,
        currentSchedule: {
          days: registration.form_data?.privateSelectedDays || [],
          timeSlot: registration.form_data?.privateTimeSlot || null
        }
      });
    }

    if (action === 'check_availability') {
      // Check specific slot availability
      if (!newDay || !newTime) {
        return res.status(400).json({
          success: false,
          error: 'Please provide newDay and newTime'
        });
      }

      // Validate day and time
      if (!AVAILABLE_DAYS.includes(newDay.toLowerCase())) {
        return res.status(400).json({
          success: false,
          error: `Invalid day. Must be one of: ${AVAILABLE_DAYS.join(', ')}`
        });
      }

      if (!AVAILABLE_TIME_SLOTS.includes(newTime)) {
        return res.status(400).json({
          success: false,
          error: `Invalid time. Must be one of: ${AVAILABLE_TIME_SLOTS.join(', ')}`
        });
      }

      // Check if slot is available
      const { data: bookings, error } = await supabase
        .from('registrations')
        .select('form_data')
        .eq('payment_status', 'active')
        .or(`form_data->programType.eq.private,form_data->programType.eq.semi-private`);

      if (error) {
        console.error('Error checking availability:', error);
        return res.status(500).json({
          success: false,
          error: 'Failed to check availability'
        });
      }

      const isBooked = bookings?.some(b => {
        const isPrivate = b.form_data?.programType === 'private';
        const isSemiPrivate = b.form_data?.programType === 'semi-private';

        if (isPrivate) {
          return b.form_data?.privateSelectedDays?.includes(newDay.toLowerCase()) &&
                 b.form_data?.privateTimeSlot === newTime;
        }

        if (isSemiPrivate) {
          return b.form_data?.semiPrivateAvailability?.includes(newDay.toLowerCase()) &&
                 b.form_data?.semiPrivateTimeSlot === newTime;
        }

        return false;
      });

      return res.status(200).json({
        success: true,
        available: !isBooked,
        day: newDay,
        time: newTime,
        message: isBooked ? 'This time slot is already booked' : 'This time slot is available'
      });
    }

    if (action === 'reschedule') {
      // Validate inputs
      if (!changeType || !newDay || !newTime) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields: changeType, newDay, newTime'
        });
      }

      // Validate day and time
      if (!AVAILABLE_DAYS.includes(newDay.toLowerCase())) {
        return res.status(400).json({
          success: false,
          error: `Invalid day. Must be one of: ${AVAILABLE_DAYS.join(', ')}`
        });
      }

      if (!AVAILABLE_TIME_SLOTS.includes(newTime)) {
        return res.status(400).json({
          success: false,
          error: `Invalid time. Must be one of: ${AVAILABLE_TIME_SLOTS.join(', ')}`
        });
      }

      // Check if slot is available
      const { data: bookings } = await supabase
        .from('registrations')
        .select('form_data')
        .eq('payment_status', 'active')
        .or(`form_data->programType.eq.private,form_data->programType.eq.semi-private`);

      const isBooked = bookings?.some(b => {
        // Exclude current registration from conflict check
        if (b.form_data?.registrationId === registrationId) return false;

        const isPrivate = b.form_data?.programType === 'private';
        const isSemiPrivate = b.form_data?.programType === 'semi-private';

        if (isPrivate) {
          return b.form_data?.privateSelectedDays?.includes(newDay.toLowerCase()) &&
                 b.form_data?.privateTimeSlot === newTime;
        }

        if (isSemiPrivate) {
          return b.form_data?.semiPrivateAvailability?.includes(newDay.toLowerCase()) &&
                 b.form_data?.semiPrivateTimeSlot === newTime;
        }

        return false;
      });

      if (isBooked) {
        return res.status(400).json({
          success: false,
          error: 'This time slot is already booked. Please choose another time.'
        });
      }

      // Create schedule change record
      const { data: scheduleChange, error: changeError } = await supabase
        .from('schedule_changes')
        .insert({
          registration_id: registrationId,
          change_type: changeType,
          program_type: 'private',
          original_days: registration.form_data?.privateSelectedDays || [],
          original_time: registration.form_data?.privateTimeSlot,
          new_days: [newDay.toLowerCase()],
          new_time: newTime,
          specific_date: changeType === 'one_time' ? specificDate : null,
          effective_date: changeType === 'permanent' ? effectiveDate || new Date().toISOString().split('T')[0] : null,
          status: 'approved', // Auto-approve
          reason,
          created_by: firebaseUid,
          approved_at: new Date().toISOString(),
          approved_by: 'system',
          applied_at: new Date().toISOString()
        })
        .select()
        .single();

      if (changeError) {
        console.error('Error creating schedule change:', changeError);
        return res.status(500).json({
          success: false,
          error: 'Failed to create schedule change'
        });
      }

      // For permanent changes, update the registration's form_data
      if (changeType === 'permanent') {
        const updatedFormData = {
          ...registration.form_data,
          privateSelectedDays: [newDay.toLowerCase()],
          privateTimeSlot: newTime
        };

        const { error: updateError } = await supabase
          .from('registrations')
          .update({
            form_data: updatedFormData,
            updated_at: new Date().toISOString()
          })
          .eq('id', registrationId);

        if (updateError) {
          console.error('Error updating registration:', updateError);
          return res.status(500).json({
            success: false,
            error: 'Failed to update schedule'
          });
        }
      }

      // For one-time changes, create a schedule exception
      if (changeType === 'one_time' && specificDate) {
        const { error: exceptionError } = await supabase
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

        if (exceptionError) {
          console.error('Error creating exception:', exceptionError);
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
        }
      });
    }

    return res.status(400).json({
      success: false,
      error: 'Invalid action. Use "get_availability", "check_availability", or "reschedule"'
    });

  } catch (error) {
    console.error('Error in reschedule-private:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
