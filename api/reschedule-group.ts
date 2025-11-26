import { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

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

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

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
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

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
      if (!newDays || newDays.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Please provide new days to check availability'
        });
      }

      const availabilityResults = await Promise.all(
        newDays.map(async (day) => {
          // Count current registrations for this day
          // FIXED: Use 'succeeded' and 'verified' instead of 'active'
          const { data: bookings, error } = await supabase
            .from('registrations')
            .select('form_data, id')
            .in('payment_status', ['succeeded', 'verified'])
            .contains('form_data->groupSelectedDays', [day.toLowerCase()]);

          if (error) {
            console.error('Error checking capacity:', error);
            return {
              day,
              available: false,
              spotsRemaining: 0,
              totalCapacity: 6,
              error: 'Failed to check capacity'
            };
          }

          const currentBookings = bookings?.filter(
            b => b.form_data?.programType === 'group'
          ).length || 0;

          const spotsRemaining = Math.max(0, 6 - currentBookings);

          return {
            day,
            available: spotsRemaining > 0,
            spotsRemaining,
            totalCapacity: 6,
            isFull: spotsRemaining === 0
          };
        })
      );

      return res.status(200).json({
        success: true,
        availability: availabilityResults
      });
    }

    if (action === 'reschedule') {
      // Validate inputs
      if (!changeType || !newDays || newDays.length === 0) {
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

      // Check capacity for all new days
      // FIXED: Use 'succeeded' and 'verified' instead of 'active'
      const capacityChecks = await Promise.all(
        newDays.map(async (day) => {
          const { data: bookings } = await supabase
            .from('registrations')
            .select('form_data, id')
            .in('payment_status', ['succeeded', 'verified'])
            .contains('form_data->groupSelectedDays', [day.toLowerCase()]);

          const currentBookings = bookings?.filter(
            b => b.form_data?.programType === 'group'
          ).length || 0;

          return {
            day,
            available: currentBookings < 6,
            spotsRemaining: Math.max(0, 6 - currentBookings)
          };
        })
      );

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
      const { data: scheduleChange, error: changeError } = await supabase
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

      // For one-time changes, create schedule exception(s)
      if (changeType === 'one_time') {
        // Handle new daySwaps array (for 2x/week users)
        if (daySwaps && daySwaps.length > 0) {
          const exceptionsToInsert = daySwaps.map(swap => ({
            registration_id: registrationId,
            exception_date: swap.originalDate,
            exception_type: 'swap',
            replacement_day: swap.newDay,
            status: 'applied',
            reason,
            created_by: firebaseUid,
            applied_at: new Date().toISOString()
          }));

          const { error: exceptionError } = await supabase
            .from('schedule_exceptions')
            .insert(exceptionsToInsert);

          if (exceptionError) {
            console.error('Error creating exceptions:', exceptionError);
          }
        }
        // Legacy support for single specificDate
        else if (specificDate) {
          const { error: exceptionError } = await supabase
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

          if (exceptionError) {
            console.error('Error creating exception:', exceptionError);
          }
        }
      }

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
