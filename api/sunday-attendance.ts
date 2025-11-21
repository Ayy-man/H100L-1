import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

/**
 * Sunday Attendance API Endpoint (Admin Only)
 * POST /api/sunday-attendance
 *
 * Marks attendance for a Sunday practice booking.
 * Updates booking status to 'attended' or 'no-show'.
 *
 * Request Body:
 *   - bookingId: UUID of the booking
 *   - attended: boolean (true = attended, false = no-show)
 *   - markedBy: string (admin name/email)
 *   - adminToken: string (admin authentication token, optional for future use)
 *
 * Returns:
 *   - success: boolean
 *   - booking_id: UUID
 *   - status: updated booking status
 *   - message: success message
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
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { bookingId, attended, markedBy } = req.body;

    // Validate required fields
    if (!bookingId || attended === undefined || !markedBy) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: bookingId, attended, and markedBy',
        code: 'MISSING_FIELDS',
      });
    }

    // Validate field formats
    if (!/^[0-9a-f-]{36}$/i.test(bookingId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid bookingId format',
        code: 'INVALID_BOOKING_ID',
      });
    }

    if (typeof attended !== 'boolean') {
      return res.status(400).json({
        success: false,
        error: 'attended must be a boolean',
        code: 'INVALID_ATTENDED_VALUE',
      });
    }

    if (typeof markedBy !== 'string' || markedBy.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'markedBy must be a non-empty string',
        code: 'INVALID_MARKED_BY',
      });
    }

    // Check if booking exists and is not cancelled
    const { data: existingBooking, error: fetchError } = await supabase
      .from('sunday_bookings')
      .select('booking_status, slot_id')
      .eq('id', bookingId)
      .single();

    if (fetchError || !existingBooking) {
      return res.status(404).json({
        success: false,
        error: 'Booking not found',
        code: 'BOOKING_NOT_FOUND',
      });
    }

    if (existingBooking.booking_status === 'cancelled') {
      return res.status(400).json({
        success: false,
        error: 'Cannot mark attendance for cancelled booking',
        code: 'BOOKING_CANCELLED',
      });
    }

    // Determine new status
    const newStatus = attended ? 'attended' : 'no-show';

    // Update the booking
    const { data: updatedBooking, error: updateError } = await supabase
      .from('sunday_bookings')
      .update({
        booking_status: newStatus,
        attended: attended,
        attendance_marked_at: new Date().toISOString(),
        attendance_marked_by: markedBy,
        updated_at: new Date().toISOString(),
      })
      .eq('id', bookingId)
      .select()
      .single();

    if (updateError) {
      console.error('Update error:', updateError);
      return res.status(500).json({
        success: false,
        error: 'Failed to update attendance',
        code: 'DATABASE_ERROR',
        details: updateError.message,
      });
    }

    return res.status(200).json({
      success: true,
      booking_id: bookingId,
      status: newStatus,
      attended: attended,
      marked_at: updatedBooking.attendance_marked_at,
      marked_by: markedBy,
      message: `Attendance marked as ${newStatus} successfully`,
    });
  } catch (error: any) {
    console.error('Sunday attendance error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to mark attendance',
      code: 'SERVER_ERROR',
    });
  }
}
