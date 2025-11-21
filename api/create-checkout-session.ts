import type { VercelRequest, VercelResponse } from '@vercel/node';
import Stripe from 'stripe';

// Initialize Stripe with secret key from environment
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-02-24.acacia',
});

interface CheckoutSessionRequest {
  priceId: string;
  registrationId: string;
  firebaseUid: string;
  customerEmail: string;
  customerName: string;
}

/**
 * Create Stripe Checkout Session API
 *
 * Creates a Stripe Checkout session for subscription payment.
 * Redirects user to Stripe-hosted checkout page.
 *
 * Success URL: /dashboard?payment=success
 * Cancel URL: /dashboard?payment=cancelled
 */
export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const {
      priceId,
      registrationId,
      firebaseUid,
      customerEmail,
      customerName,
    } = req.body as CheckoutSessionRequest;

    // Validate required fields
    if (!priceId || !registrationId || !firebaseUid || !customerEmail) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Validate field formats
    if (!priceId.startsWith('price_')) {
      return res.status(400).json({ error: 'Invalid price ID format' });
    }
    if (!/^[\w-]+$/.test(registrationId)) {
      return res.status(400).json({ error: 'Invalid registration ID format' });
    }
    if (!/^[\w-]+$/.test(firebaseUid)) {
      return res.status(400).json({ error: 'Invalid Firebase UID format' });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }
    if (customerName && customerName.length > 100) {
      return res.status(400).json({ error: 'Customer name too long' });
    }

    // Get the base URL for redirects
    const protocol = req.headers['x-forwarded-proto'] || 'http';
    const host = req.headers['x-forwarded-host'] || req.headers.host;
    const baseUrl = `${protocol}://${host}`;

    // Create Checkout Session
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      customer_email: customerEmail,
      client_reference_id: registrationId,
      metadata: {
        registrationId,
        firebaseUid,
        customerName,
      },
      subscription_data: {
        metadata: {
          registrationId,
          firebaseUid,
        },
      },
      success_url: `${baseUrl}/dashboard?payment=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/dashboard?payment=cancelled`,
      allow_promotion_codes: true,
      billing_address_collection: 'auto',
    });

    return res.status(200).json({
      success: true,
      sessionId: session.id,
      url: session.url,
    });
  } catch (error: any) {
    console.error('Checkout session creation error:', error);

    return res.status(500).json({
      error: error.message || 'Failed to create checkout session',
      type: error.type,
    });
  }
}
