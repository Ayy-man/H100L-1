import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

/**
 * Sunday Upcoming Slots API Endpoint
 * GET /api/sunday-upcoming-slots
 *
 * Gets the next 2 upcoming Sunday practice slots for a registered player.
 * Returns capacity information and booking status for each slot.
 *
 * Query Parameters:
 *   - registrationId: UUID of the registration
 *   - firebaseUid: Firebase UID for authentication
 *   - weeks: Number of weeks to fetch (default: 2, max: 4)
 *
 * Returns:
 *   - success: boolean
 *   - eligible: boolean (is player eligible for Sunday practice)
 *   - weeks: array of week objects with slots and capacity
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
    const { registrationId, firebaseUid, weeks } = req.query;

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

    // Parse and validate weeks parameter (default to 2, max 4)
    let numWeeks = 2;
    if (weeks) {
      const parsed = parseInt(weeks as string, 10);
      if (isNaN(parsed) || parsed < 1 || parsed > 4) {
        return res.status(400).json({
          success: false,
          error: 'weeks parameter must be between 1 and 4',
        });
      }
      numWeeks = parsed;
    }

    // Call the database function
    const { data, error } = await supabase.rpc('get_upcoming_sunday_slots', {
      p_registration_id: registrationId,
      p_firebase_uid: firebaseUid,
      p_num_weeks: numWeeks,
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
    console.error('Sunday upcoming slots error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to get upcoming Sunday slots',
    });
  }
}
