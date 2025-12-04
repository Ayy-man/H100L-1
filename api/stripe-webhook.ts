import type { VercelRequest, VercelResponse } from '@vercel/node';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import { Readable } from 'stream';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-02-24.acacia',
});

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

// Helper to convert VercelRequest to buffer
async function buffer(readable: Readable) {
  const chunks: Buffer[] = [];
  for await (const chunk of readable) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks);
}

export const config = {
  api: {
    bodyParser: false, // Disable body parsing, need raw body for webhook verification
  },
};

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const sig = req.headers['stripe-signature'] as string;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

  let event: Stripe.Event;

  try {
    const rawBody = await buffer(req as unknown as Readable);
    event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
  } catch (err: any) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle the event
  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutSessionCompleted(event.data.object as Stripe.Checkout.Session);
        break;

      case 'payment_intent.succeeded':
        await handlePaymentIntentSucceeded(event.data.object as Stripe.PaymentIntent);
        break;

      case 'payment_intent.payment_failed':
        await handlePaymentIntentFailed(event.data.object as Stripe.PaymentIntent);
        break;

      case 'invoice.payment_succeeded':
        await handleInvoicePaymentSucceeded(event.data.object as Stripe.Invoice);
        break;

      case 'invoice.payment_failed':
        await handleInvoicePaymentFailed(event.data.object as Stripe.Invoice);
        break;

      case 'customer.subscription.created':
        await handleSubscriptionCreated(event.data.object as Stripe.Subscription);
        break;

      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
        break;

      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;

      default:
    }

    return res.json({ received: true });
  } catch (error: any) {
    console.error('Webhook handler error:', error);
    return res.status(500).json({ error: error.message });
  }
}

// Event handlers
async function handleCheckoutSessionCompleted(session: Stripe.Checkout.Session) {

  const registrationId = session.client_reference_id || session.metadata?.registrationId;
  if (!registrationId) {
    console.error('No registration ID found in checkout session');
    return;
  }

  // Get subscription ID from session
  const subscriptionId = session.subscription as string;
  const customerId = session.customer as string;

  // Update registration with Stripe IDs and set payment status to succeeded
  const { error } = await getSupabase()
    .from('registrations')
    .update({
      stripe_customer_id: customerId,
      stripe_subscription_id: subscriptionId,
      payment_status: 'succeeded',
      updated_at: new Date().toISOString(),
    })
    .eq('id', registrationId);

  if (error) {
    console.error(`Failed to update registration ${registrationId}:`, error);
    throw new Error(`Database update failed: ${error.message}`);
  }

}

async function handlePaymentIntentSucceeded(paymentIntent: Stripe.PaymentIntent) {

  const registrationId = paymentIntent.metadata.registrationId;
  if (!registrationId) return;

  const { error } = await getSupabase()
    .from('registrations')
    .update({
      payment_status: 'succeeded',
      updated_at: new Date().toISOString(),
    })
    .eq('id', registrationId);

  if (error) {
    console.error(`Failed to update registration ${registrationId}:`, error);
    throw new Error(`Database update failed: ${error.message}`);
  }
}

async function handlePaymentIntentFailed(paymentIntent: Stripe.PaymentIntent) {

  const registrationId = paymentIntent.metadata.registrationId;
  if (!registrationId) return;

  const { error } = await getSupabase()
    .from('registrations')
    .update({
      payment_status: 'failed',
      updated_at: new Date().toISOString(),
    })
    .eq('id', registrationId);

  if (error) {
    console.error(`Failed to update registration ${registrationId}:`, error);
    throw new Error(`Database update failed: ${error.message}`);
  }
}

async function handleInvoicePaymentSucceeded(invoice: Stripe.Invoice) {

  // Get subscription from invoice
  const subscriptionId = invoice.subscription as string;
  if (!subscriptionId) return;

  // Update all registrations with this subscription
  // FIXED: Use 'succeeded' instead of 'active'
  await getSupabase()
    .from('registrations')
    .update({
      payment_status: 'succeeded',
      updated_at: new Date().toISOString(),
    })
    .eq('stripe_subscription_id', subscriptionId);
}

async function handleInvoicePaymentFailed(invoice: Stripe.Invoice) {

  const subscriptionId = invoice.subscription as string;
  if (!subscriptionId) return;

  await getSupabase()
    .from('registrations')
    .update({
      payment_status: 'past_due',
      updated_at: new Date().toISOString(),
    })
    .eq('stripe_subscription_id', subscriptionId);
}

// Helper to map Stripe subscription status to our payment status
function mapStripeStatusToPaymentStatus(stripeStatus: string): string {
  // Our valid statuses: pending, succeeded, failed, canceled, verified
  // Stripe statuses: active, past_due, canceled, unpaid, trialing, incomplete, incomplete_expired
  switch (stripeStatus) {
    case 'active':
    case 'trialing':
      return 'succeeded';
    case 'past_due':
    case 'unpaid':
      return 'pending';
    case 'canceled':
    case 'incomplete_expired':
      return 'canceled';
    case 'incomplete':
      return 'pending';
    default:
      return 'pending';
  }
}

async function handleSubscriptionCreated(subscription: Stripe.Subscription) {

  const registrationId = subscription.metadata.registrationId;
  if (!registrationId) return;

  await getSupabase()
    .from('registrations')
    .update({
      stripe_subscription_id: subscription.id,
      payment_status: mapStripeStatusToPaymentStatus(subscription.status),
      updated_at: new Date().toISOString(),
    })
    .eq('id', registrationId);
}

async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {

  await getSupabase()
    .from('registrations')
    .update({
      payment_status: mapStripeStatusToPaymentStatus(subscription.status),
      updated_at: new Date().toISOString(),
    })
    .eq('stripe_subscription_id', subscription.id);
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {

  await getSupabase()
    .from('registrations')
    .update({
      payment_status: 'canceled',
      updated_at: new Date().toISOString(),
    })
    .eq('stripe_subscription_id', subscription.id);
}
