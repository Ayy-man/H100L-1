import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { notifySundayCancelled } from '../lib/notificationHelper';

/**
 * Sunday Cancel API Endpoint
 * POST /api/sunday-cancel
 *
 * Cancels a Sunday practice booking.
 * Updates booking status and releases the slot capacity.
 *
 * Request Body:
 *   - bookingId: UUID of the booking to cancel
 *   - registrationId: UUID of the registration (ownership validation)
 *   - firebaseUid: Firebase UID for authentication
 *
 * Returns:
 *   - success: boolean
 *   - message: success message
 *   - error: error message (if failed)
 *   - code: error code (if failed)
 */

// Initialize Supabase client
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
    const { bookingId, registrationId, firebaseUid } = req.body;

    // Validate required fields
    if (!bookingId || !registrationId || !firebaseUid) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: bookingId, registrationId, and firebaseUid',
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

    if (!/^[0-9a-f-]{36}$/i.test(registrationId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid registrationId format',
        code: 'INVALID_REGISTRATION_ID',
      });
    }

    if (!/^[\w-]+$/.test(firebaseUid)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid firebaseUid format',
        code: 'INVALID_FIREBASE_UID',
      });
    }

    // Call the database function to cancel the booking
    const { data, error } = await supabase.rpc('cancel_sunday_booking', {
      p_booking_id: bookingId,
      p_registration_id: registrationId,
      p_firebase_uid: firebaseUid,
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
        OWNERSHIP_VERIFICATION_FAILED: 403,
        BOOKING_NOT_FOUND: 404,
        ALREADY_CANCELLED: 409,
        BOOKING_PAST: 400,
        DATABASE_ERROR: 500,
      };

      const statusCode = statusMap[data.code] || 400;
      return res.status(statusCode).json(data);
    }

    // Send notification on successful cancellation
    try {
      // Fetch registration details for notification
      const { data: registration } = await supabase
        .from('registrations')
        .select('form_data')
        .eq('id', registrationId)
        .single();

      if (registration) {
        await notifySundayCancelled({
          parentUserId: firebaseUid,
          playerName: registration.form_data?.playerFullName || 'Player',
          practiceDate: data.slot_date || 'scheduled date',
          registrationId
        });
      }
    } catch (notificationError) {
      // Don't fail the cancellation if notification fails
      console.error('Error sending Sunday cancellation notification:', notificationError);
    }

    // Success - return 200 with confirmation
    return res.status(200).json(data);
  } catch (error: any) {
    console.error('Sunday cancellation error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to cancel Sunday booking',
      code: 'SERVER_ERROR',
    });
  }
}
