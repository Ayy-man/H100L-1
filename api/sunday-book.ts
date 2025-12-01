import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

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

// Initialize Supabase client lazily to avoid crashes if env vars are missing
const getSupabase = () => {
  return createClient(
    process.env.VITE_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
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
    const supabase = getSupabase();
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

    // Check if data is null/undefined (shouldn't happen but handle gracefully)
    if (!data) {
      console.error('Database returned null data without error');
      return res.status(500).json({
        success: false,
        error: 'Unexpected database response',
        code: 'NULL_RESPONSE',
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
        CATEGORY_MISMATCH: 403,
        DUPLICATE_BOOKING: 409,
        DATABASE_ERROR: 500,
      };

      const statusCode = statusMap[data.code] || 400;
      return res.status(statusCode).json(data);
    }

    // Send notification on successful booking (inline to avoid import issues)
    try {
      // Fetch registration details for notification
      const { data: registration } = await supabase
        .from('registrations')
        .select('form_data')
        .eq('id', registrationId)
        .single();

      if (registration) {
        // Create notification directly instead of using helper
        await supabase.from('notifications').insert({
          user_id: firebaseUid,
          user_type: 'parent',
          type: 'sunday_booking',
          title: 'Sunday Practice Booked',
          message: `${registration.form_data?.playerFullName || 'Player'} is booked for Sunday ice practice on ${data.slot_date} at ${data.time_range}.`,
          priority: 'normal',
          data: {
            registration_id: registrationId,
            player_name: registration.form_data?.playerFullName,
            practice_date: data.slot_date,
            time_slot: data.time_range
          },
          action_url: '/schedule'
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
