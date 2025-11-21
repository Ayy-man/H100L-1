import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

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
    const { registrationId, adminEmail, reason } = req.body;

    // Validate inputs
    if (!registrationId || !adminEmail) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Verify registration exists
    const { data: registration, error: fetchError } = await supabase
      .from('registrations')
      .select('*')
      .eq('id', registrationId)
      .single();

    if (fetchError || !registration) {
      return res.status(404).json({ error: 'Registration not found' });
    }

    // Update registration with manual confirmation
    const { data, error } = await supabase
      .from('registrations')
      .update({
        payment_status: 'succeeded',
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
