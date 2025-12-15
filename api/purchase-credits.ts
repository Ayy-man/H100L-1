import type { VercelRequest, VercelResponse } from '@vercel/node';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

// Inline types and constants (Vercel bundling doesn't resolve ../types/credits)
type CreditPackageType = 'single' | '10_pack' | '20_pack';

interface PurchaseCreditsRequest {
  firebase_uid: string;
  package_type: CreditPackageType;
  success_url: string;
  cancel_url: string;
}

interface PurchaseCreditsResponse {
  checkout_url: string;
  session_id: string;
}

interface CreditPurchaseMetadata {
  type: 'credit_purchase';
  firebase_uid: string;
  package_type: CreditPackageType;
  credits: string;
}

const CREDIT_PRICING = {
  single: {
    credits: 1,
    price: 4500,
    priceFormatted: '$45.00',
    description: 'Single Session',
    validityMonths: 12,
  },
  '10_pack': {
    credits: 10,
    price: 35000,
    priceFormatted: '$350.00',
    perCreditPrice: 3500,
    description: '10-Session Package',
    validityMonths: 12,
  },
  '20_pack': {
    credits: 20,
    price: 50000,
    priceFormatted: '$500.00',
    perCreditPrice: 2500,
    description: '20-Session Package',
    validityMonths: 12,
  },
} as const;

function isCreditPackageType(value: string): value is CreditPackageType {
  return ['single', '10_pack', '20_pack'].includes(value);
}

// Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-02-24.acacia',
});

// Inline Supabase client for Vercel bundling
function getSupabase() {
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error('Missing Supabase environment variables');
  }

  return createClient(url, key);
}

// Credit package price IDs (to be set in environment)
const CREDIT_PRICE_IDS: Record<CreditPackageType, string> = {
  single: process.env.VITE_STRIPE_PRICE_CREDIT_SINGLE || '',
  '10_pack': process.env.VITE_STRIPE_PRICE_CREDIT_10PACK || '',
  '20_pack': process.env.VITE_STRIPE_PRICE_CREDIT_20PACK || '',
};

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { firebase_uid, package_type, success_url, cancel_url } = req.body as PurchaseCreditsRequest;

    // Validate required fields
    if (!firebase_uid || !package_type || !success_url || !cancel_url) {
      return res.status(400).json({
        error: 'Missing required fields: firebase_uid, package_type, success_url, cancel_url',
      });
    }

    // Validate package type
    if (!isCreditPackageType(package_type)) {
      return res.status(400).json({
        error: 'Invalid package_type. Must be "single" or "20_pack"',
      });
    }

    // Get price ID for the package
    const priceId = CREDIT_PRICE_IDS[package_type];
    if (!priceId) {
      console.error(`Price ID not configured for package type: ${package_type}`);
      return res.status(500).json({
        error: 'Credit package price not configured. Contact support.',
      });
    }

    // Ensure parent_credits record exists
    const supabase = getSupabase();
    const { data: existingCredits, error: fetchError } = await supabase
      .from('parent_credits')
      .select('id')
      .eq('firebase_uid', firebase_uid)
      .single();

    if (fetchError && fetchError.code !== 'PGRST116') {
      // PGRST116 = no rows returned
      console.error('Error checking parent_credits:', fetchError);
      return res.status(500).json({ error: 'Database error' });
    }

    // Create parent_credits record if it doesn't exist
    if (!existingCredits) {
      const { error: insertError } = await supabase
        .from('parent_credits')
        .insert({
          firebase_uid,
          total_credits: 0,
        });

      if (insertError) {
        console.error('Error creating parent_credits record:', insertError);
        return res.status(500).json({ error: 'Failed to initialize credit account' });
      }
    }

    // Get parent email for Stripe customer
    const { data: registrations } = await supabase
      .from('registrations')
      .select('parent_email')
      .eq('firebase_uid', firebase_uid)
      .limit(1)
      .single();

    const customerEmail = registrations?.parent_email || undefined;

    // Create metadata for webhook processing
    const metadata: CreditPurchaseMetadata = {
      type: 'credit_purchase',
      firebase_uid,
      package_type,
      credits: String(CREDIT_PRICING[package_type].credits),
    };

    // Create Stripe Checkout Session for one-time payment
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      customer_email: customerEmail,
      metadata,
      success_url: `${success_url}?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url,
      // Collect billing address for tax purposes
      billing_address_collection: 'required',
      // Automatic tax calculation (if configured in Stripe)
      automatic_tax: {
        enabled: true,
      },
    });

    const response: PurchaseCreditsResponse = {
      checkout_url: session.url!,
      session_id: session.id,
    };

    return res.status(200).json(response);
  } catch (error: any) {
    console.error('Purchase credits error:', error);

    if (error instanceof Stripe.errors.StripeError) {
      return res.status(400).json({
        error: error.message,
      });
    }

    return res.status(500).json({
      error: 'Failed to create checkout session',
    });
  }
}
