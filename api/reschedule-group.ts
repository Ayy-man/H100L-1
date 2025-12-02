import { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
// TEMPORARILY DISABLED to debug crash
// import { notifyScheduleChanged } from '../lib/notificationHelper';

console.log('[reschedule-group] Module loaded');

// Inline date generation to avoid import issues in serverless
function generateMonthlyDates(selectedDays: string[]): string[] {
  if (selectedDays.length === 0) return [];

  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  const firstDayOfMonth = new Date(currentYear, currentMonth, 1);
  const lastDayOfMonth = new Date(currentYear, currentMonth + 1, 0);

  const dayNameToNumber: Record<string, number> = {
    sunday: 0,
    monday: 1,
    tuesday: 2,
    wednesday: 3,
    thursday: 4,
    friday: 5,
    saturday: 6,
  };

  const selectedDayNumbers = selectedDays.map(day => dayNameToNumber[day.toLowerCase()]);
  const dates: string[] = [];

  for (let date = new Date(firstDayOfMonth); date <= lastDayOfMonth; date.setDate(date.getDate() + 1)) {
    const dayOfWeek = date.getDay();
    if (selectedDayNumbers.includes(dayOfWeek)) {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      dates.push(`${year}-${month}-${day}`);
    }
  }

  return dates;
}

// Lazy-initialized Supabase client to avoid cold start issues
let _supabase: ReturnType<typeof createClient> | null = null;

const getSupabase = () => {
  if (!_supabase) {
    _supabase = createClient(
      process.env.VITE_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
  }
  return _supabase;
};

/**
 * Group Training Rescheduling API
 *
 * Allows parents to reschedule their group training days:
 * - One-time: Change for a specific week only
 * - Permanent: Change ongoing schedule
 *
 * Business Rules:
 * - Player can only change DAYS, not time slot (time is fixed by age category)
 * - 1x/week player: Can swap to 1 different day
 * - 2x/week player: Can swap 1 or both days
 * - Must check capacity of target day before allowing
 */

interface DaySwap {
  originalDay: string;
  originalDate: string;
  newDay: string;
}

interface RescheduleRequest {
  action: 'check_availability' | 'reschedule';
  registrationId: string;
  firebaseUid: string;
  changeType?: 'one_time' | 'permanent';
  originalDays?: string[];
  newDays?: string[];
  specificDate?: string; // For one-time changes (legacy, single day)
  daySwaps?: DaySwap[]; // For one-time changes (multiple days)
  effectiveDate?: string; // For permanent changes
  reason?: string;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  console.log('[reschedule-group] Handler invoked, method:', req.method);

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  console.log('[reschedule-group] Starting request processing');

  try {
    const {
      action,
      registrationId,
      firebaseUid,
      changeType,
      originalDays,
      newDays,
      specificDate,
      daySwaps,
      effectiveDate,
      reason
    } = req.body as RescheduleRequest;

    // Validate registration ownership
    const { data: registration, error: regError } = await getSupabase()
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

    // Verify it's a group training registration
    if (registration.form_data?.programType !== 'group') {
      return res.status(400).json({
        success: false,
        error: 'This endpoint is only for Group Training rescheduling'
      });
    }

    const playerCategory = registration.form_data?.playerCategory;
    const groupFrequency = registration.form_data?.groupFrequency;

    if (action === 'check_availability') {
      // Check availability for new days
      if (!newDays || !Array.isArray(newDays) || newDays.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Please provide new days to check availability'
        });
      }

      // Fetch ALL group registrations once (more efficient)
      const { data: allBookings, error: fetchError } = await getSupabase()
        .from('registrations')
        .select('form_data, id')
        .in('payment_status', ['succeeded', 'verified']);

      if (fetchError) {
        console.error('Error fetching bookings:', fetchError);
        return res.status(500).json({
          success: false,
          error: 'Failed to check availability'
        });
      }

      // Filter to group registrations only (with null safety)
      const groupBookings = (allBookings || []).filter(b => b.form_data?.programType === 'group');

      const availabilityResults = newDays.map(day => {
        const dayLower = (day || '').toLowerCase();

        // Count registrations for this specific day (filter in JS)
        const currentBookings = groupBookings.filter(b => {
          const selectedDays = b.form_data?.groupSelectedDays || [];
          if (!Array.isArray(selectedDays)) return false;
          return selectedDays.map((d: string) => (d || '').toLowerCase()).includes(dayLower);
        }).length;

        const spotsRemaining = Math.max(0, 6 - currentBookings);

        return {
          day,
          available: spotsRemaining > 0,
          spotsRemaining,
          totalCapacity: 6,
          isFull: spotsRemaining === 0
        };
      });

      return res.status(200).json({
        success: true,
        availability: availabilityResults
      });
    }

    if (action === 'reschedule') {
      // Validate inputs
      if (!changeType || !newDays || !Array.isArray(newDays) || newDays.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields: changeType, newDays'
        });
      }

      // Validate frequency constraints
      const maxDays = groupFrequency === '1x' ? 1 : 2;
      if (newDays.length !== maxDays) {
        return res.status(400).json({
          success: false,
          error: `You must select exactly ${maxDays} day(s) based on your ${groupFrequency} frequency`
        });
      }

      // Check capacity for all new days - fetch all once and filter in JS
      const { data: allCapacityBookings } = await getSupabase()
        .from('registrations')
        .select('form_data, id')
        .in('payment_status', ['succeeded', 'verified']);

      const groupCapacityBookings = (allCapacityBookings || []).filter(b => b.form_data?.programType === 'group');

      const capacityChecks = newDays.map(day => {
        const dayLower = (day || '').toLowerCase();

        // Count registrations for this day, excluding current registration
        const currentBookings = groupCapacityBookings.filter(b => {
          if (b.id === registrationId) return false; // Exclude current registration
          const selectedDays = b.form_data?.groupSelectedDays || [];
          if (!Array.isArray(selectedDays)) return false;
          return selectedDays.map((d: string) => (d || '').toLowerCase()).includes(dayLower);
        }).length;

        return {
          day,
          available: currentBookings < 6,
          spotsRemaining: Math.max(0, 6 - currentBookings)
        };
      });

      // Check if any day is full
      const fullDays = capacityChecks.filter(c => !c.available);
      if (fullDays.length > 0) {
        return res.status(400).json({
          success: false,
          error: `The following days are full: ${fullDays.map(d => d.day).join(', ')}`,
          fullDays
        });
      }

      // Create schedule change record
      const { data: scheduleChange, error: changeError } = await getSupabase()
        .from('schedule_changes')
        .insert({
          registration_id: registrationId,
          change_type: changeType,
          program_type: 'group',
          original_days: originalDays || registration.form_data?.groupSelectedDays || [],
          new_days: newDays,
          specific_date: changeType === 'one_time'
            ? (daySwaps && daySwaps.length > 0 ? daySwaps[0].originalDate : specificDate)
            : null,
          effective_date: changeType === 'permanent' ? effectiveDate || new Date().toISOString().split('T')[0] : null,
          status: 'approved', // Auto-approve for now
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
        // Convert newDays to lowercase to ensure compatibility
        const normalizedDays = newDays.map(day => day.toLowerCase());

        const updatedFormData = {
          ...registration.form_data,
          groupSelectedDays: normalizedDays,
          groupMonthlyDates: generateMonthlyDates(normalizedDays)
        };

        const { error: updateError } = await getSupabase()
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

      // For one-time changes, create/update schedule exception(s)
      // Check if exception exists first, then update or insert (since upsert requires unique constraint)
      if (changeType === 'one_time') {
        // Handle new daySwaps array (for 2x/week users)
        if (daySwaps && daySwaps.length > 0) {
          // Process each day swap - check for existing, then update or insert
          for (const swap of daySwaps) {
            // Check if exception already exists for this date
            const { data: existingException } = await getSupabase()
              .from('schedule_exceptions')
              .select('id')
              .eq('registration_id', registrationId)
              .eq('exception_date', swap.originalDate)
              .single();

            if (existingException) {
              // Update existing exception
              const { error: updateError } = await getSupabase()
                .from('schedule_exceptions')
                .update({
                  replacement_day: swap.newDay,
                  status: 'applied',
                  reason,
                  applied_at: new Date().toISOString()
                })
                .eq('id', existingException.id);

              if (updateError) {
                console.error('Error updating exception:', updateError);
                return res.status(500).json({
                  success: false,
                  error: 'Failed to update schedule exception',
                  details: updateError.message
                });
              }
            } else {
              // Insert new exception
              const { error: insertError } = await getSupabase()
                .from('schedule_exceptions')
                .insert({
                  registration_id: registrationId,
                  exception_date: swap.originalDate,
                  exception_type: 'swap',
                  replacement_day: swap.newDay,
                  status: 'applied',
                  reason,
                  created_by: firebaseUid,
                  applied_at: new Date().toISOString()
                });

              if (insertError) {
                console.error('Error inserting exception:', insertError);
                return res.status(500).json({
                  success: false,
                  error: 'Failed to create schedule exception',
                  details: insertError.message
                });
              }
            }
          }
        }
        // Legacy support for single specificDate
        else if (specificDate) {
          // Check if exception already exists for this date
          const { data: existingException } = await getSupabase()
            .from('schedule_exceptions')
            .select('id')
            .eq('registration_id', registrationId)
            .eq('exception_date', specificDate)
            .single();

          if (existingException) {
            // Update existing exception
            const { error: updateError } = await getSupabase()
              .from('schedule_exceptions')
              .update({
                replacement_day: newDays[0],
                status: 'applied',
                reason,
                applied_at: new Date().toISOString()
              })
              .eq('id', existingException.id);

            if (updateError) {
              console.error('Error updating exception:', updateError);
              return res.status(500).json({
                success: false,
                error: 'Failed to update schedule exception',
                details: updateError.message
              });
            }
          } else {
            // Insert new exception
            const { error: insertError } = await getSupabase()
              .from('schedule_exceptions')
              .insert({
                registration_id: registrationId,
                exception_date: specificDate,
                exception_type: 'swap',
                replacement_day: newDays[0],
                status: 'applied',
                reason,
                created_by: firebaseUid,
                applied_at: new Date().toISOString()
              });

            if (insertError) {
              console.error('Error inserting exception:', insertError);
              return res.status(500).json({
                success: false,
                error: 'Failed to create schedule exception',
                details: insertError.message
              });
            }
          }
        } else {
          // Neither daySwaps nor specificDate provided - this is a bug
          console.error('One-time change requested but no daySwaps or specificDate provided');
          return res.status(400).json({
            success: false,
            error: 'One-time change requires daySwaps or specificDate'
          });
        }
      }

      // TEMPORARILY DISABLED - notification import was causing crash
      // try {
      //   const originalDaysStr = (originalDays || registration.form_data?.groupSelectedDays || [])
      //     .map((d: string) => d.charAt(0).toUpperCase() + d.slice(1))
      //     .join(', ');
      //   const newDaysStr = newDays
      //     .map((d: string) => d.charAt(0).toUpperCase() + d.slice(1))
      //     .join(', ');
      //   await notifyScheduleChanged({
      //     parentUserId: firebaseUid,
      //     playerName: registration.form_data?.playerFullName || 'Your child',
      //     changeType: changeType,
      //     originalSchedule: originalDaysStr,
      //     newSchedule: newDaysStr,
      //     registrationId,
      //   });
      // } catch (notifyError) {
      //   console.error('Failed to send schedule change notification:', notifyError);
      // }

      return res.status(200).json({
        success: true,
        message: changeType === 'permanent'
          ? 'Your schedule has been permanently updated'
          : 'Your one-time schedule change has been applied',
        scheduleChange,
        capacityChecks
      });
    }

    return res.status(400).json({
      success: false,
      error: 'Invalid action. Use "check_availability" or "reschedule"'
    });

  } catch (error) {
    console.error('Error in reschedule-group:', error);
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

