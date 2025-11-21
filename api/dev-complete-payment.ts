import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

/**
 * DEV MODE ONLY: Instantly Complete Payment
 *
 * This endpoint bypasses Stripe entirely and directly marks a payment as succeeded.
 * Perfect for rapid local testing without going through Stripe checkout flow.
 *
 * SECURITY: Only works when NODE_ENV !== 'production'
 *
 * Usage:
 * POST /api/dev-complete-payment
 * Body: { registrationId, firebaseUid }
 */
export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // CRITICAL SECURITY CHECK: Only allow in development
  if (process.env.NODE_ENV === 'production') {
    console.error('[DEV-PAYMENT] Attempted to use dev payment in production - BLOCKED');
    return res.status(403).json({
      error: 'Dev mode payment endpoint not available in production',
      code: 'DEV_MODE_DISABLED'
    });
  }

  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { registrationId, firebaseUid } = req.body;

    // Validate required fields
    if (!registrationId || !firebaseUid) {
      return res.status(400).json({
        error: 'Missing required fields: registrationId and firebaseUid',
        code: 'MISSING_FIELDS'
      });
    }

    // Validate field formats
    if (!/^[0-9a-f-]{36}$/i.test(registrationId)) {
      return res.status(400).json({
        error: 'Invalid registrationId format',
        code: 'INVALID_REGISTRATION_ID'
      });
    }

    if (!/^[\w-]+$/.test(firebaseUid)) {
      return res.status(400).json({
        error: 'Invalid firebaseUid format',
        code: 'INVALID_FIREBASE_UID'
      });
    }

    console.log('[DEV-PAYMENT] Processing dev mode payment for:', { registrationId, firebaseUid });

    // Initialize Supabase with service role
    const supabase = createClient(
      process.env.VITE_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Verify registration exists and belongs to user
    const { data: registration, error: fetchError } = await supabase
      .from('registrations')
      .select('id, payment_status')
      .eq('id', registrationId)
      .eq('firebase_uid', firebaseUid)
      .single();

    if (fetchError || !registration) {
      console.error('[DEV-PAYMENT] Registration not found:', fetchError);
      return res.status(404).json({
        error: 'Registration not found or unauthorized',
        code: 'REGISTRATION_NOT_FOUND'
      });
    }

    // Check if already paid
    if (registration.payment_status === 'succeeded') {
      console.log('[DEV-PAYMENT] Payment already succeeded');
      return res.status(200).json({
        success: true,
        message: 'Payment already completed',
        already_paid: true,
      });
    }

    // Generate fake Stripe IDs (for dev testing)
    const timestamp = Date.now();
    const fakeCustomerId = `cus_dev_${timestamp}`;
    const fakeSubscriptionId = `sub_dev_${timestamp}`;

    // Update payment status to succeeded
    const { error: updateError } = await supabase
      .from('registrations')
      .update({
        payment_status: 'succeeded',
        stripe_customer_id: fakeCustomerId,
        stripe_subscription_id: fakeSubscriptionId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', registrationId)
      .eq('firebase_uid', firebaseUid);

    if (updateError) {
      console.error('[DEV-PAYMENT] Failed to update registration:', updateError);
      return res.status(500).json({
        error: 'Failed to update payment status',
        details: updateError.message,
        code: 'DATABASE_ERROR'
      });
    }

    console.log('[DEV-PAYMENT] ✅ Payment completed successfully', {
      registrationId,
      customerId: fakeCustomerId,
      subscriptionId: fakeSubscriptionId,
    });

    return res.status(200).json({
      success: true,
      message: '💰 Dev Mode: Payment completed instantly!',
      dev_mode: true,
      payment_status: 'succeeded',
      stripe_customer_id: fakeCustomerId,
      stripe_subscription_id: fakeSubscriptionId,
    });
  } catch (error: any) {
    console.error('[DEV-PAYMENT] Unexpected error:', error);
    return res.status(500).json({
      error: error.message || 'Failed to process dev payment',
      code: 'SERVER_ERROR'
    });
  }
}
