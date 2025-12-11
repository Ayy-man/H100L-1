import { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { MAX_GROUP_CAPACITY } from '../types/credits';

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
 * Group Capacity API
 *
 * GET /api/group-capacity?days=monday,tuesday
 * GET /api/group-capacity?date=2025-01-15&time_slot=5:45%20PM
 *
 * Returns capacity information for specified days or specific date/time slots.
 *
 * Supports both:
 * - Legacy subscription-based capacity (from registrations table)
 * - New credit/booking-based capacity (from session_bookings table)
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { days, date, time_slot } = req.query;
    const supabase = getSupabase();

    // NEW: Check specific date/time slot capacity using session_bookings
    if (date && typeof date === 'string') {
      const timeSlot = time_slot as string || null;

      // Use the database function if available, otherwise count manually
      if (timeSlot) {
        const { data: capacity, error } = await supabase.rpc('get_slot_capacity', {
          p_session_date: date,
          p_time_slot: timeSlot,
          p_session_type: 'group',
          p_max_capacity: MAX_GROUP_CAPACITY,
        });

        if (error) {
          // Fallback: count manually from session_bookings
          const { data: bookings, count } = await supabase
            .from('session_bookings')
            .select('id', { count: 'exact' })
            .eq('session_date', date)
            .eq('time_slot', timeSlot)
            .eq('session_type', 'group')
            .in('status', ['booked', 'attended']);

          const currentBookings = count || 0;
          return res.status(200).json({
            success: true,
            capacity: {
              date,
              time_slot: timeSlot,
              spotsUsed: currentBookings,
              spotsRemaining: Math.max(0, MAX_GROUP_CAPACITY - currentBookings),
              totalCapacity: MAX_GROUP_CAPACITY,
              isFull: currentBookings >= MAX_GROUP_CAPACITY,
            },
          });
        }

        if (capacity && capacity.length > 0) {
          return res.status(200).json({
            success: true,
            capacity: {
              date,
              time_slot: timeSlot,
              spotsUsed: capacity[0].current_bookings,
              spotsRemaining: capacity[0].available_spots,
              totalCapacity: MAX_GROUP_CAPACITY,
              isFull: !capacity[0].is_available,
            },
          });
        }
      }

      // If no time_slot, return capacity for all time slots on that date
      const { data: dayBookings, error: dayError } = await supabase
        .from('session_bookings')
        .select('time_slot')
        .eq('session_date', date)
        .eq('session_type', 'group')
        .in('status', ['booked', 'attended']);

      if (dayError) {
        console.error('Error fetching day bookings:', dayError);
        return res.status(500).json({ success: false, error: 'Database error' });
      }

      // Count bookings per time slot
      const timeSlotCounts: Record<string, number> = {};
      (dayBookings || []).forEach((b) => {
        timeSlotCounts[b.time_slot] = (timeSlotCounts[b.time_slot] || 0) + 1;
      });

      const GROUP_TRAINING_TIMES = ['4:30 PM', '5:45 PM', '7:00 PM', '8:15 PM'];
      const slotCapacity = GROUP_TRAINING_TIMES.map((slot) => {
        const used = timeSlotCounts[slot] || 0;
        return {
          time_slot: slot,
          spotsUsed: used,
          spotsRemaining: Math.max(0, MAX_GROUP_CAPACITY - used),
          totalCapacity: MAX_GROUP_CAPACITY,
          isFull: used >= MAX_GROUP_CAPACITY,
        };
      });

      return res.status(200).json({
        success: true,
        date,
        capacity: slotCapacity,
      });
    }

    // LEGACY: Day-based capacity checking (for subscription model)
    if (!days || typeof days !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameter: days (comma-separated) or date',
      });
    }

    const dayList = days.toLowerCase().split(',').map((d) => d.trim());

    // Fetch capacity for each day using legacy subscription approach
    const capacityResults = await Promise.all(
      dayList.map(async (day) => {
        const { data: bookings, error } = await supabase
          .from('registrations')
          .select('form_data, id')
          .in('payment_status', ['succeeded', 'verified'])
          .contains('form_data->groupSelectedDays', [day]);

        if (error) {
          console.error(`Error checking capacity for ${day}:`, error);
          return {
            day,
            spotsUsed: 0,
            spotsRemaining: MAX_GROUP_CAPACITY,
            totalCapacity: MAX_GROUP_CAPACITY,
            error: 'Failed to check capacity',
          };
        }

        // Count only group training registrations
        const currentBookings =
          bookings?.filter((b) => b.form_data?.programType === 'group').length || 0;

        const spotsRemaining = Math.max(0, MAX_GROUP_CAPACITY - currentBookings);

        return {
          day,
          spotsUsed: currentBookings,
          spotsRemaining,
          totalCapacity: MAX_GROUP_CAPACITY,
          isFull: spotsRemaining === 0,
        };
      })
    );

    return res.status(200).json({
      success: true,
      capacity: capacityResults.reduce(
        (acc, item) => {
          acc[item.day] = item;
          return acc;
        },
        {} as Record<string, (typeof capacityResults)[0]>
      ),
    });
  } catch (error) {
    console.error('Error in group-capacity:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
