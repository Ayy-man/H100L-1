import type { VercelRequest, VercelResponse } from '@vercel/node';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import type {
  PurchaseSessionRequest,
  PurchaseSessionResponse,
  SessionPurchaseMetadata,
} from '../types/credits';

// Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-02-24.acacia',
});

// Lazy-initialized Supabase client
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

// Session price IDs from environment
const SESSION_PRICE_IDS = {
  sunday: process.env.VITE_STRIPE_PRICE_SUNDAY || '',
  semi_private: process.env.VITE_STRIPE_PRICE_SEMI_PRIVATE_SESSION || '',
  private: process.env.VITE_STRIPE_PRICE_PRIVATE_SESSION || '',
} as const;

// Session descriptions
const SESSION_DESCRIPTIONS = {
  sunday: 'Sunday Ice Practice',
  semi_private: 'Semi-Private Training Session',
  private: 'Private Training Session',
} as const;

// Max capacity per session type
const SESSION_CAPACITY = {
  sunday: 20,
  semi_private: 3,
  private: 1,
} as const;

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const {
      firebase_uid,
      registration_id,
      session_type,
      session_date,
      time_slot,
      success_url,
      cancel_url,
    } = req.body as PurchaseSessionRequest;

    // Validate required fields
    if (!firebase_uid || !registration_id || !session_type || !session_date || !time_slot || !success_url || !cancel_url) {
      return res.status(400).json({
        error: 'Missing required fields',
      });
    }

    // Validate session type
    if (!['sunday', 'semi_private', 'private'].includes(session_type)) {
      return res.status(400).json({
        error: 'Invalid session_type. Must be "sunday", "semi_private", or "private"',
      });
    }

    // Get price ID for the session type
    const priceId = SESSION_PRICE_IDS[session_type];
    if (!priceId) {
      console.error(`Price ID not configured for session type: ${session_type}`);
      return res.status(500).json({
        error: 'Session price not configured. Contact support.',
      });
    }

    const supabase = getSupabase();

    // Verify registration belongs to this user
    const { data: registration, error: regError } = await supabase
      .from('registrations')
      .select('id, firebase_uid, parent_email')
      .eq('id', registration_id)
      .eq('firebase_uid', firebase_uid)
      .single();

    if (regError || !registration) {
      return res.status(404).json({
        error: 'Registration not found or does not belong to this user',
      });
    }

    // Check slot availability
    const { data: slotCapacity, error: capacityError } = await supabase
      .rpc('get_slot_capacity', {
        p_session_date: session_date,
        p_time_slot: time_slot,
        p_session_type: session_type,
        p_max_capacity: SESSION_CAPACITY[session_type],
      });

    if (capacityError) {
      console.error('Error checking capacity:', capacityError);
      return res.status(500).json({ error: 'Failed to check availability' });
    }

    if (!slotCapacity || slotCapacity.length === 0 || !slotCapacity[0].is_available) {
      return res.status(409).json({
        error: 'This time slot is fully booked. Please select another time.',
      });
    }

    // Check existing booking to prevent duplicates
    const { data: existingBooking } = await supabase
      .from('session_bookings')
      .select('id')
      .eq('registration_id', registration_id)
      .eq('session_date', session_date)
      .eq('time_slot', time_slot)
      .eq('session_type', session_type)
      .neq('status', 'cancelled')
      .single();

    if (existingBooking) {
      return res.status(409).json({
        error: 'This child already has a booking for this session',
      });
    }

    // Create metadata for webhook processing
    const metadata: SessionPurchaseMetadata = {
      type: 'session_purchase',
      firebase_uid,
      registration_id,
      session_type,
      session_date,
      time_slot,
    };

    // Create Stripe Checkout Session
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      customer_email: registration.parent_email || undefined,
      metadata,
      success_url: `${success_url}?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url,
      billing_address_collection: 'required',
      automatic_tax: {
        enabled: true,
      },
    });

    const response: PurchaseSessionResponse = {
      checkout_url: session.url!,
      session_id: session.id,
    };

    return res.status(200).json(response);
  } catch (error: any) {
    console.error('Purchase session error:', error);

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
