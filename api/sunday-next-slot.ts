import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

/**
 * Sunday Next Slot API Endpoint
 * GET /api/sunday-next-slot
 *
 * Gets the next available Sunday practice slot for a registered player.
 * Checks eligibility and returns available slots or existing booking.
 *
 * Query Parameters:
 *   - registrationId: UUID of the registration
 *   - firebaseUid: Firebase UID for authentication
 *
 * Returns:
 *   - success: boolean
 *   - eligible: boolean (is player eligible for Sunday practice)
 *   - already_booked: boolean (does player already have a booking)
 *   - next_sunday: ISO date string
 *   - available_slots: array of available slots with details
 *   - reason: string (if ineligible, explains why)
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
  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { registrationId, firebaseUid } = req.query;

    // Validate required parameters
    if (!registrationId || !firebaseUid) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameters: registrationId and firebaseUid',
      });
    }

    // Validate parameter formats
    if (typeof registrationId !== 'string' || !/^[0-9a-f-]{36}$/i.test(registrationId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid registrationId format',
      });
    }

    if (typeof firebaseUid !== 'string' || !/^[\w-]+$/.test(firebaseUid)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid firebaseUid format',
      });
    }

    // Call the database function
    const { data, error } = await supabase.rpc('get_next_sunday_slot', {
      p_registration_id: registrationId,
      p_firebase_uid: firebaseUid,
    });

    if (error) {
      console.error('Database error:', error);
      return res.status(500).json({
        success: false,
        error: 'Database query failed',
        details: error.message,
      });
    }

    // Return the result from the database function
    return res.status(200).json(data);
  } catch (error: any) {
    console.error('Sunday next slot error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to get next Sunday slot',
    });
  }
}
