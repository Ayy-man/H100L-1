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

// Inline Supabase client for Vercel bundling (no caching to avoid stale connections)
function getSupabase() {
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error('Missing Supabase environment variables');
  }

  return createClient(url, key);
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // Early env var validation
  if (!process.env.VITE_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('[get-children] Missing env vars:', {
      hasUrl: !!process.env.VITE_SUPABASE_URL,
      hasKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    });
    return res.status(500).json({ error: 'Server configuration error' });
  }

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

    // Transform registrations into child objects
    // NOTE: All session types are available to all registered players
    // programType is kept for legacy compatibility but not used for access control
    const children = registrations.map((reg: any) => {
      const formData = reg.form_data;
      const playerName = formData.playerFullName || 'Unknown Player';
      const playerCategory = formData.playerCategory || 'Unknown';

      // Simple display name: just player name and category
      const profileDisplayName = `${playerName} (${playerCategory})`;

      return {
        registrationId: reg.id,
        profileDisplayName,
        playerName,
        playerCategory,
        // Legacy fields - kept for compatibility but not used for restrictions
        programType: formData.programType || 'all',
        frequency: null,
        paymentStatus: reg.payment_status || 'pending',
        hasActiveSubscription: true, // All registered players can book any session
        isCanceled: reg.canceled_at !== null,
        createdAt: reg.created_at,
        stripeSubscriptionId: reg.stripe_subscription_id,
      };
    });

    // NEW: Fetch credit balance for this parent (credit system)
    let creditBalance = 0;
    let creditInfo = null;
    const { data: parentCredits } = await getSupabase()
      .from('parent_credits')
      .select('total_credits')
      .eq('firebase_uid', firebaseUid)
      .single();

    if (parentCredits) {
      creditBalance = parentCredits.total_credits;

      // Get expiring credits info
      const thirtyDaysFromNow = new Date();
      thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

      const { data: expiringPurchases } = await getSupabase()
        .from('credit_purchases')
        .select('credits_remaining, expires_at')
        .eq('firebase_uid', firebaseUid)
        .eq('status', 'active')
        .gt('credits_remaining', 0)
        .lte('expires_at', thirtyDaysFromNow.toISOString())
        .gt('expires_at', new Date().toISOString());

      const expiringCredits = (expiringPurchases || []).reduce(
        (sum, p) => sum + p.credits_remaining,
        0
      );

      creditInfo = {
        total_credits: creditBalance,
        expiring_soon: expiringCredits,
        has_credits: creditBalance > 0,
      };
    }

    return res.status(200).json({
      success: true,
      children,
      count: children.length,
      // NEW: Include credit balance for parent
      credits: creditInfo,
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
