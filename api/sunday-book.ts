import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { notifySundayBooked } from '../lib/notificationHelper';

/**
 * Sunday Book API Endpoint
 * POST /api/sunday-book
 *
 * Books a Sunday practice slot for a registered player.
 * Validates eligibility, capacity, and prevents duplicate bookings.
 *
 * Request Body:
 *   - slotId: UUID of the time slot
 *   - registrationId: UUID of the registration
 *   - firebaseUid: Firebase UID for authentication
 *
 * Returns:
 *   - success: boolean
 *   - booking_id: UUID (if successful)
 *   - slot_date: ISO date string
 *   - time_range: formatted time range (e.g., "7:30 AM - 8:30 AM")
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
    const { slotId, registrationId, firebaseUid } = req.body;

    // Validate required fields
    if (!slotId || !registrationId || !firebaseUid) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: slotId, registrationId, and firebaseUid',
        code: 'MISSING_FIELDS',
      });
    }

    // Validate field formats
    if (!/^[0-9a-f-]{36}$/i.test(slotId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid slotId format',
        code: 'INVALID_SLOT_ID',
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

    // Call the database function to book the slot
    const { data, error } = await supabase.rpc('book_sunday_slot', {
      p_slot_id: slotId,
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
        SLOT_NOT_FOUND: 404,
        SLOT_FULL: 409,
        SLOT_PAST: 400,
        REGISTRATION_NOT_FOUND: 404,
        INVALID_PROGRAM_TYPE: 403,
        PAYMENT_REQUIRED: 402,
        INELIGIBLE_CATEGORY: 403,
        DUPLICATE_BOOKING: 409,
        DATABASE_ERROR: 500,
      };

      const statusCode = statusMap[data.code] || 400;
      return res.status(statusCode).json(data);
    }

    // Send notification on successful booking
    try {
      // Fetch registration details for notification
      const { data: registration } = await supabase
        .from('registrations')
        .select('form_data')
        .eq('id', registrationId)
        .single();

      if (registration) {
        await notifySundayBooked({
          parentUserId: firebaseUid,
          playerName: registration.form_data?.playerFullName || 'Player',
          practiceDate: data.slot_date,
          timeSlot: data.time_range,
          registrationId
        });
      }
    } catch (notificationError) {
      // Don't fail the booking if notification fails
      console.error('Error sending Sunday booking notification:', notificationError);
    }

    // Success - return 200 with booking details
    return res.status(200).json(data);
  } catch (error: any) {
    console.error('Sunday booking error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to book Sunday slot',
      code: 'SERVER_ERROR',
    });
  }
}
