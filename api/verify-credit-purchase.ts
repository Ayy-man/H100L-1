import type { VercelRequest, VercelResponse } from '@vercel/node';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

/**
 * Verify Credit Purchase API
 *
 * Called after Stripe checkout redirect to verify payment and fulfill the order.
 * This replaces webhook-based fulfillment for credit purchases.
 *
 * Flow:
 * 1. User completes Stripe checkout
 * 2. Redirected to /dashboard?payment=success&type=credits&session_id=cs_xxx
 * 3. Frontend calls this API with session_id
 * 4. We verify payment, create credit_purchases record, update parent_credits
 *
 * Idempotent: Safe to call multiple times (checks for existing purchase)
 */

function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error('Missing STRIPE_SECRET_KEY environment variable');
  }
  return new Stripe(key, { apiVersion: '2025-02-24.acacia' });
}

function getSupabase() {
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('Missing Supabase environment variables');
  }
  return createClient(url, key);
}

// Credit package definitions (must match purchase-credits.ts)
const CREDIT_PACKAGES = {
  single: { credits: 1, price: 45, validityMonths: 12 },
  '10_pack': { credits: 10, price: 350, validityMonths: 12 },
  '20_pack': { credits: 20, price: 500, validityMonths: 12 },
  '50_pack': { credits: 50, price: 1000, validityMonths: 12 },
} as const;

type PackageType = keyof typeof CREDIT_PACKAGES;

function isValidPackageType(value: string): value is PackageType {
  return Object.keys(CREDIT_PACKAGES).includes(value);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Validate environment
  if (!process.env.STRIPE_SECRET_KEY || !process.env.VITE_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('[verify-credit-purchase] Missing environment variables');
    return res.status(500).json({ error: 'Server configuration error' });
  }

  try {
    const { session_id } = req.body;

    // Validate session_id format
    if (!session_id || typeof session_id !== 'string') {
      return res.status(400).json({ error: 'Missing session_id' });
    }

    if (!session_id.startsWith('cs_')) {
      return res.status(400).json({ error: 'Invalid session_id format' });
    }

    const stripe = getStripe();
    const supabase = getSupabase();

    // 1. Retrieve checkout session from Stripe
    console.log(`[verify-credit-purchase] Retrieving session: ${session_id}`);

    let session: Stripe.Checkout.Session;
    try {
      session = await stripe.checkout.sessions.retrieve(session_id, {
        expand: ['payment_intent'],
      });
    } catch (stripeError: any) {
      console.error('[verify-credit-purchase] Stripe retrieve error:', stripeError.message);
      return res.status(400).json({
        error: 'Invalid or expired session',
        details: stripeError.message
      });
    }

    // 2. Verify this is a credit purchase session
    if (session.metadata?.type !== 'credit_purchase') {
      console.error('[verify-credit-purchase] Invalid session type:', session.metadata?.type);
      return res.status(400).json({
        error: 'Invalid session type',
        expected: 'credit_purchase',
        received: session.metadata?.type
      });
    }

    // 3. Verify payment is complete
    if (session.status !== 'complete') {
      return res.status(400).json({
        error: 'Checkout session not complete',
        status: session.status,
      });
    }

    if (session.payment_status !== 'paid') {
      return res.status(400).json({
        error: 'Payment not completed',
        payment_status: session.payment_status,
      });
    }

    // 4. Check for duplicate processing (idempotency)
    const { data: existingPurchase, error: checkError } = await supabase
      .from('credit_purchases')
      .select('id, credits_purchased')
      .eq('stripe_checkout_session_id', session_id)
      .maybeSingle();

    if (checkError) {
      console.error('[verify-credit-purchase] Error checking existing purchase:', checkError);
      // Continue anyway - better to risk duplicate than fail legitimate purchase
    }

    if (existingPurchase) {
      console.log(`[verify-credit-purchase] Already processed: ${session_id}`);

      // Fetch current balance for response
      const { data: creditData } = await supabase
        .from('parent_credits')
        .select('total_credits')
        .eq('firebase_uid', session.metadata.firebase_uid)
        .single();

      return res.status(200).json({
        success: true,
        already_processed: true,
        credits_added: existingPurchase.credits_purchased,
        current_balance: creditData?.total_credits || 0,
        message: 'Payment was already processed',
      });
    }

    // 5. Extract and validate metadata
    const firebase_uid = session.metadata.firebase_uid;
    const package_type = session.metadata.package_type;
    const credits_str = session.metadata.credits;

    if (!firebase_uid) {
      console.error('[verify-credit-purchase] Missing firebase_uid in metadata');
      return res.status(400).json({ error: 'Missing user ID in session' });
    }

    if (!package_type || !isValidPackageType(package_type)) {
      console.error('[verify-credit-purchase] Invalid package_type:', package_type);
      return res.status(400).json({ error: 'Invalid package type in session' });
    }

    const credits = parseInt(credits_str, 10);
    if (isNaN(credits) || credits <= 0) {
      console.error('[verify-credit-purchase] Invalid credits:', credits_str);
      return res.status(400).json({ error: 'Invalid credits in session' });
    }

    // 6. Get payment amount (convert from cents to dollars)
    const amountPaid = (session.amount_total || 0) / 100;

    // 7. Get payment intent ID
    const paymentIntentId = typeof session.payment_intent === 'string'
      ? session.payment_intent
      : session.payment_intent?.id || null;

    // 8. Calculate expiry date (12 months from now)
    const expiresAt = new Date();
    expiresAt.setFullYear(expiresAt.getFullYear() + 1);

    // 9. Ensure parent_credits record exists
    const { data: existingCredits, error: fetchError } = await supabase
      .from('parent_credits')
      .select('id, total_credits')
      .eq('firebase_uid', firebase_uid)
      .maybeSingle();

    if (fetchError && fetchError.code !== 'PGRST116') {
      console.error('[verify-credit-purchase] Error fetching parent_credits:', fetchError);
    }

    // Create parent_credits record if it doesn't exist
    if (!existingCredits) {
      const { error: createError } = await supabase
        .from('parent_credits')
        .insert({
          firebase_uid,
          total_credits: 0,
        });

      if (createError && !createError.message.includes('duplicate')) {
        console.error('[verify-credit-purchase] Error creating parent_credits:', createError);
        return res.status(500).json({ error: 'Failed to initialize credit account' });
      }
    }

    // 10. Create credit_purchases record
    console.log(`[verify-credit-purchase] Creating purchase record: ${credits} credits for ${firebase_uid}`);

    const { error: purchaseError } = await supabase
      .from('credit_purchases')
      .insert({
        firebase_uid,
        package_type,
        credits_purchased: credits,
        credits_remaining: credits,
        price_paid: amountPaid,
        currency: session.currency || 'cad',
        stripe_checkout_session_id: session_id,
        stripe_payment_intent_id: paymentIntentId,
        expires_at: expiresAt.toISOString(),
        status: 'active',
      });

    if (purchaseError) {
      // Check if it's a duplicate key error (race condition)
      if (purchaseError.message.includes('duplicate') || purchaseError.code === '23505') {
        console.log('[verify-credit-purchase] Duplicate detected via constraint');

        const { data: creditData } = await supabase
          .from('parent_credits')
          .select('total_credits')
          .eq('firebase_uid', firebase_uid)
          .single();

        return res.status(200).json({
          success: true,
          already_processed: true,
          credits_added: credits,
          current_balance: creditData?.total_credits || 0,
        });
      }

      console.error('[verify-credit-purchase] Error creating purchase:', purchaseError);
      return res.status(500).json({ error: 'Failed to record purchase' });
    }

    // 11. Update parent_credits total
    const currentTotal = existingCredits?.total_credits || 0;
    const newTotal = currentTotal + credits;

    const { error: updateError } = await supabase
      .from('parent_credits')
      .update({
        total_credits: newTotal,
        updated_at: new Date().toISOString(),
      })
      .eq('firebase_uid', firebase_uid);

    if (updateError) {
      console.error('[verify-credit-purchase] Error updating total credits:', updateError);
      // Purchase record exists, so credits should still be usable
      // Don't fail the request, but log the error
    }

    console.log(`[verify-credit-purchase] Success: ${credits} credits added for ${firebase_uid}, new balance: ${newTotal}`);

    return res.status(200).json({
      success: true,
      credits_added: credits,
      new_balance: newTotal,
      package_type,
      amount_paid: amountPaid,
      expires_at: expiresAt.toISOString(),
    });

  } catch (error: any) {
    console.error('[verify-credit-purchase] Unexpected error:', error);
    return res.status(500).json({
      error: error.message || 'Failed to verify payment',
    });
  }
}
