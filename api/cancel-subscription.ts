import type { VercelRequest, VercelResponse } from '@vercel/node';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-11-20.acacia',
});

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * Cancel Subscription API
 *
 * Cancels a Stripe subscription and updates the database
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { registrationId, firebaseUid } = req.body;

    if (!registrationId || !firebaseUid) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Get registration from database
    const { data: registration, error: fetchError } = await supabase
      .from('registrations')
      .select('*')
      .eq('id', registrationId)
      .eq('firebase_uid', firebaseUid)
      .single();

    if (fetchError || !registration) {
      console.error('Failed to fetch registration:', fetchError);
      return res.status(404).json({ error: 'Registration not found' });
    }

    // Check if subscription exists
    if (!registration.stripe_subscription_id) {
      return res.status(400).json({ error: 'No active subscription found' });
    }

    // Cancel subscription in Stripe (at period end - won't charge them again)
    const canceledSubscription = await stripe.subscriptions.update(
      registration.stripe_subscription_id,
      {
        cancel_at_period_end: true,
        metadata: {
          canceled_by: 'customer',
          canceled_at: new Date().toISOString(),
        },
      }
    );

    // Update registration in database
    const { error: updateError } = await supabase
      .from('registrations')
      .update({
        payment_status: 'canceled',
        updated_at: new Date().toISOString(),
        // Store cancellation metadata
        stripe_subscription_id: registration.stripe_subscription_id,
        canceled_at: new Date().toISOString(),
      })
      .eq('id', registrationId);

    if (updateError) {
      console.error('Failed to update registration:', updateError);
      return res.status(500).json({ error: 'Failed to update registration' });
    }

    // Return success with cancellation details
    return res.status(200).json({
      success: true,
      message: 'Subscription canceled successfully',
      canceledAt: canceledSubscription.canceled_at,
      currentPeriodEnd: canceledSubscription.current_period_end,
      willCancelAt: new Date(canceledSubscription.current_period_end * 1000).toLocaleDateString(),
    });

  } catch (error: any) {
    console.error('Cancel subscription error:', error);
    return res.status(500).json({
      error: error.message || 'Failed to cancel subscription'
    });
  }
}
