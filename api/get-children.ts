import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

/**
 * Get Children API Endpoint
 * GET /api/get-children
 *
 * Retrieves all child registrations for a parent's Firebase account.
 * Supports multi-child functionality by returning all registrations
 * associated with a single firebase_uid.
 *
 * Query Parameters:
 *   - firebaseUid: Firebase UID of the parent
 *
 * Returns:
 *   - success: boolean
 *   - children: Array of child registration objects
 *   - count: Number of children
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
  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { firebaseUid } = req.query;

    // Validate required parameter
    if (!firebaseUid || typeof firebaseUid !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Missing or invalid firebaseUid parameter',
        code: 'MISSING_FIREBASE_UID',
      });
    }

    // Validate firebaseUid format
    if (!/^[\w-]+$/.test(firebaseUid)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid firebaseUid format',
        code: 'INVALID_FIREBASE_UID',
      });
    }

    // Fetch all registrations for this firebase_uid
    const { data: registrations, error } = await getSupabase()
      .from('registrations')
      .select(`
        id,
        created_at,
        payment_status,
        stripe_subscription_id,
        canceled_at,
        form_data
      `)
      .eq('firebase_uid', firebaseUid)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Database error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch registrations',
        code: 'DATABASE_ERROR',
        details: error.message,
      });
    }

    // Transform registrations into child objects with profile display names
    const children = registrations.map((reg: any) => {
      const formData = reg.form_data;
      const programType = formData.programType || 'unknown';
      const playerName = formData.playerFullName || 'Unknown Player';

      // Generate profile display name
      let profileDisplayName = playerName;

      if (programType === 'group') {
        const frequency = (formData.groupFrequency || '').toUpperCase();
        profileDisplayName = `${playerName} - Group ${frequency}`;
      } else if (programType === 'private') {
        const frequency = formData.privateFrequency;
        if (frequency && frequency !== 'one-time') {
          profileDisplayName = `${playerName} - Private ${frequency.toUpperCase()}`;
        } else {
          profileDisplayName = `${playerName} - Private`;
        }
      } else if (programType === 'semi-private') {
        profileDisplayName = `${playerName} - Semi-Private`;
      } else {
        profileDisplayName = `${playerName} - ${programType.charAt(0).toUpperCase() + programType.slice(1)}`;
      }

      return {
        registrationId: reg.id,
        profileDisplayName,
        playerName,
        playerCategory: formData.playerCategory || 'Unknown',
        programType,
        frequency: programType === 'group'
          ? formData.groupFrequency
          : programType === 'private'
          ? formData.privateFrequency
          : null,
        paymentStatus: reg.payment_status || 'pending',
        hasActiveSubscription: reg.payment_status === 'succeeded' || reg.payment_status === 'verified',
        isCanceled: reg.canceled_at !== null,
        createdAt: reg.created_at,
        stripeSubscriptionId: reg.stripe_subscription_id,
      };
    });

    return res.status(200).json({
      success: true,
      children,
      count: children.length,
    });
  } catch (error: any) {
    console.error('Get children error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch children',
      code: 'SERVER_ERROR',
    });
  }
}
