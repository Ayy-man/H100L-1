import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

/**
 * Sunday Roster API Endpoint (Admin Only)
 * GET /api/sunday-roster
 *
 * Gets the complete roster for a specific Sunday practice date.
 * Returns all bookings grouped by time slot with player details.
 *
 * Query Parameters:
 *   - date: ISO date string (YYYY-MM-DD) of the Sunday to fetch
 *   - adminToken: Admin authentication token (optional, for future use)
 *
 * Returns:
 *   - success: boolean
 *   - practice_date: ISO date string
 *   - slots: array of slots with bookings
 *     - slot_id: UUID
 *     - time_range: formatted time (e.g., "7:30 AM - 8:30 AM")
 *     - age_range: category range (e.g., "M11 - M13 Elite")
 *     - capacity: formatted capacity (e.g., "4/6")
 *     - bookings: array of booking details
 */

// Initialize Supabase client with service role for admin access
const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { date } = req.query;

    // If no date provided, get next Sunday
    let targetDate: string;
    if (date) {
      if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid date format. Use YYYY-MM-DD',
          code: 'INVALID_DATE_FORMAT',
        });
      }
      targetDate = date;
    } else {
      // Calculate next Sunday
      const today = new Date();
      const dayOfWeek = today.getDay();
      const daysUntilSunday = dayOfWeek === 0 ? 7 : 7 - dayOfWeek;
      const nextSunday = new Date(today);
      nextSunday.setDate(today.getDate() + daysUntilSunday);
      targetDate = nextSunday.toISOString().split('T')[0];
    }

    // Fetch slots for the target date
    const { data: slots, error: slotsError } = await supabase
      .from('sunday_practice_slots')
      .select('*')
      .eq('practice_date', targetDate)
      .order('start_time', { ascending: true });

    if (slotsError) {
      console.error('Slots query error:', slotsError);
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch practice slots',
        code: 'DATABASE_ERROR',
        details: slotsError.message,
      });
    }

    if (!slots || slots.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'No slots found for this date',
        code: 'NO_SLOTS_FOUND',
        practice_date: targetDate,
      });
    }

    // Fetch bookings for all slots on this date
    const { data: bookings, error: bookingsError } = await supabase
      .from('sunday_bookings_detail')
      .select('*')
      .eq('practice_date', targetDate)
      .order('start_time', { ascending: true });

    if (bookingsError) {
      console.error('Bookings query error:', bookingsError);
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch bookings',
        code: 'DATABASE_ERROR',
        details: bookingsError.message,
      });
    }

    // Format the response
    const formattedSlots = slots.map((slot) => {
      const slotBookings = bookings?.filter((b) => b.slot_id === slot.id) || [];

      return {
        slot_id: slot.id,
        time_range: `${formatTime(slot.start_time)} - ${formatTime(slot.end_time)}`,
        age_range: `${slot.min_category} - ${slot.max_category}`,
        capacity: `${slot.current_bookings}/${slot.max_capacity}`,
        available_spots: slot.available_spots,
        bookings: slotBookings.map((booking) => ({
          booking_id: booking.booking_id,
          player_name: booking.player_name,
          player_category: booking.player_category,
          parent_email: booking.parent_email,
          parent_name: booking.parent_name,
          booking_status: booking.booking_status,
          attended: booking.attended,
          booked_at: booking.booked_at,
          registration_id: booking.registration_id,
        })),
      };
    });

    return res.status(200).json({
      success: true,
      practice_date: targetDate,
      slots: formattedSlots,
    });
  } catch (error: any) {
    console.error('Sunday roster error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch Sunday roster',
      code: 'SERVER_ERROR',
    });
  }
}

/**
 * Helper function to format time from HH:MM:SS to HH:MM AM/PM
 */
function formatTime(timeString: string): string {
  const [hours, minutes] = timeString.split(':');
  const hour = parseInt(hours, 10);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
  return `${displayHour}:${minutes} ${ampm}`;
}
