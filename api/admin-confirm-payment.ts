import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { notifyPaymentConfirmed } from '../lib/notificationHelper';

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

/**
 * Admin Confirm Payment API
 *
 * Allows admin users to manually confirm a payment.
 * This is used for:
 * - Offline payments (cash, e-transfer)
 * - Payments made outside normal flow
 * - Manual verification from Stripe
 * - Error overrides
 *
 * The "manually_confirmed" flag indicates owner verification,
 * which takes precedence over automatic payment status.
 */
export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { registrationId, adminEmail = 'admin', reason } = req.body;

    // Validate inputs
    if (!registrationId) {
      return res.status(400).json({ error: 'Missing registration ID' });
    }

    // Verify registration exists
    const { data: registration, error: fetchError } = await getSupabase()
      .from('registrations')
      .select('*')
      .eq('id', registrationId)
      .single();

    if (fetchError || !registration) {
      return res.status(404).json({ error: 'Registration not found' });
    }

    // Update registration with manual confirmation
    // Set status to 'verified' - one step above 'succeeded'
    const { data, error } = await getSupabase()
      .from('registrations')
      .update({
        payment_status: 'verified',
        manually_confirmed: true,
        manually_confirmed_by: adminEmail,
        manually_confirmed_at: new Date().toISOString(),
        manually_confirmed_reason: reason || 'Admin override',
        updated_at: new Date().toISOString(),
      })
      .eq('id', registrationId)
      .select()
      .single();

    if (error) {
      console.error(`Failed to confirm payment for ${registrationId}:`, error);
      return res.status(500).json({
        error: 'Database update failed',
        details: error.message
      });
    }

    console.log(`✅ Payment manually confirmed for registration ${registrationId} by ${adminEmail}`);

    // Send notification to parent
    try {
      if (registration.firebase_uid) {
        await notifyPaymentConfirmed({
          parentUserId: registration.firebase_uid,
          playerName: registration.form_data?.playerFullName || 'Player',
          registrationId,
          confirmedBy: adminEmail
        });
      }
    } catch (notificationError) {
      // Don't fail the request if notification fails
      console.error('Error sending payment confirmation notification:', notificationError);
    }

    return res.status(200).json({
      success: true,
      registration: {
        id: data.id,
        payment_status: data.payment_status,
        manually_confirmed: data.manually_confirmed,
        manually_confirmed_by: data.manually_confirmed_by,
        manually_confirmed_at: data.manually_confirmed_at,
      },
    });
  } catch (error: any) {
    console.error('Admin confirm payment error:', error);

    return res.status(500).json({
      error: error.message || 'Failed to confirm payment',
    });
  }
}
