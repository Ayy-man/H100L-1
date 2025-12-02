import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

/**
 * Sunday Attendance API Endpoint (Admin Only)
 * POST /api/sunday-attendance
 *
 * Marks attendance for a Sunday practice booking.
 * Updates attendance status to: attended, absent, or excused
 *
 * Request Body:
 *   - bookingId: UUID of the booking
 *   - attendanceStatus: string ('attended', 'absent', or 'excused')
 *   - markedBy: string (admin name/email)
 *   - notes: string (optional admin notes)
 *
 * Returns:
 *   - success: boolean
 *   - booking_id: UUID
 *   - attendance_status: updated attendance status
 *   - message: success message
 */

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

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { bookingId, attendanceStatus, markedBy, notes } = req.body;

    // Validate required fields
    if (!bookingId || !attendanceStatus || !markedBy) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: bookingId, attendanceStatus, and markedBy',
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

    if (!['attended', 'absent', 'excused'].includes(attendanceStatus)) {
      return res.status(400).json({
        success: false,
        error: 'attendanceStatus must be: attended, absent, or excused',
        code: 'INVALID_ATTENDANCE_STATUS',
      });
    }

    if (typeof markedBy !== 'string' || markedBy.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'markedBy must be a non-empty string',
        code: 'INVALID_MARKED_BY',
      });
    }

    // Call the database function to mark attendance
    const { data, error } = await getSupabase().rpc('mark_attendance', {
      p_booking_id: bookingId,
      p_attendance_status: attendanceStatus,
      p_admin_email: markedBy,
      p_notes: notes || null,
    });

    if (error) {
      console.error('Database error:', error);
      return res.status(500).json({
        success: false,
        error: 'Database query failed',
        code: 'DATABASE_ERROR',
        details: error.message,
      });
    }

    // The database function returns a JSON object with success/error
    if (!data.success) {
      // Map error codes to appropriate HTTP status codes
      const statusMap: Record<string, number> = {
        BOOKING_NOT_FOUND: 404,
        BOOKING_CANCELLED: 400,
        INVALID_STATUS: 400,
        DATABASE_ERROR: 500,
      };

      const statusCode = statusMap[data.code] || 400;
      return res.status(statusCode).json(data);
    }

    // Success - return 200 with confirmation
    return res.status(200).json(data);
  } catch (error: any) {
    console.error('Sunday attendance error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to mark attendance',
      code: 'SERVER_ERROR',
    });
  }
}
