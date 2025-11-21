import type { VercelRequest, VercelResponse } from '@vercel/node';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-02-24.acacia',
});

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * Verify Payment Session API
 *
 * Retrieves a Stripe Checkout Session and updates the registration
 * with payment details. This replaces webhook-based payment verification.
 *
 * Usage: Called from frontend after successful Stripe redirect
 */
export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { sessionId } = req.body;

    if (!sessionId || !sessionId.startsWith('cs_')) {
      return res.status(400).json({ error: 'Invalid session ID' });
    }

    // Retrieve the session from Stripe
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['subscription', 'customer'],
    });

    // Verify session is complete and paid
    if (session.status !== 'complete') {
      return res.status(400).json({
        error: 'Session not complete',
        status: session.status
      });
    }

    if (session.payment_status !== 'paid') {
      return res.status(400).json({
        error: 'Payment not completed',
        paymentStatus: session.payment_status
      });
    }

    // Get registration ID from session
    const registrationId = session.client_reference_id || session.metadata?.registrationId;

    if (!registrationId) {
      return res.status(400).json({ error: 'No registration ID found in session' });
    }

    // Extract IDs
    const customerId = typeof session.customer === 'string'
      ? session.customer
      : session.customer?.id;

    const subscriptionId = typeof session.subscription === 'string'
      ? session.subscription
      : session.subscription?.id;

    // Update registration in database
    const { data, error } = await supabase
      .from('registrations')
      .update({
        stripe_customer_id: customerId,
        stripe_subscription_id: subscriptionId,
        payment_status: 'succeeded',
        updated_at: new Date().toISOString(),
      })
      .eq('id', registrationId)
      .select()
      .single();

    if (error) {
      console.error(`Failed to update registration ${registrationId}:`, error);
      return res.status(500).json({
        error: 'Database update failed',
        details: error.message
      });
    }

    console.log(`✅ Payment verified for registration ${registrationId}`);

    return res.status(200).json({
      success: true,
      registration: {
        id: data.id,
        payment_status: data.payment_status,
        stripe_customer_id: data.stripe_customer_id,
        stripe_subscription_id: data.stripe_subscription_id,
      },
    });
  } catch (error: any) {
    console.error('Payment verification error:', error);

    return res.status(500).json({
      error: error.message || 'Failed to verify payment',
      type: error.type,
    });
  }
}
