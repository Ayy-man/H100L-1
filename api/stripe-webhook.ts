import type { VercelRequest, VercelResponse } from '@vercel/node';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import { Readable } from 'stream';
// n8nWebhook imported dynamically to prevent function crash if module fails to load

// Inline types (Vercel bundling doesn't resolve ../types/credits)
type CreditPackageType = 'single' | '10_pack' | '20_pack' | '50_pack';
type SessionType = 'group' | 'sunday' | 'private' | 'semi_private';

interface CreditPurchaseMetadata {
  type: 'credit_purchase';
  firebase_uid: string;
  package_type: CreditPackageType;
  credits: string; // Stripe metadata must be strings
}

interface SessionPurchaseMetadata {
  type: 'session_purchase';
  firebase_uid: string;
  registration_id: string;
  session_type: SessionType;
  session_date: string;
  time_slot: string;
}

const CREDIT_PRICING = {
  single: {
    credits: 1,
    price: 4500, // $45.00 CAD in cents
    priceFormatted: '$45.00',
    description: 'Single Session',
    validityMonths: 12,
  },
  '10_pack': {
    credits: 10,
    price: 35000, // $350.00 CAD in cents
    priceFormatted: '$350.00',
    perCreditPrice: 3500, // $35.00 per credit
    description: '10-Session Package',
    validityMonths: 12,
  },
  '20_pack': {
    credits: 20,
    price: 50000, // $500.00 CAD in cents
    priceFormatted: '$500.00',
    perCreditPrice: 2500, // $25.00 per credit
    description: '20-Session Package',
    validityMonths: 12,
  },
  '50_pack': {
    credits: 50,
    price: 100000, // $1,000.00 CAD in cents
    priceFormatted: '$1,000.00',
    perCreditPrice: 2000, // $20.00 per credit
    description: '50-Session Package',
    validityMonths: 12,
  },
} as const;

// Inline Supabase client for Vercel bundling (no caching to avoid stale connections)
function getSupabase() {
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error('Missing Supabase environment variables');
  }

  return createClient(url, key);
}

function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error('Missing STRIPE_SECRET_KEY environment variable');
  }
  return new Stripe(key, { apiVersion: '2025-02-24.acacia' });
}

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
  // Early env var validation
  if (!process.env.VITE_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY ||
      !process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_WEBHOOK_SECRET) {
    console.error('[stripe-webhook] Missing env vars:', {
      hasSupabaseUrl: !!process.env.VITE_SUPABASE_URL,
      hasSupabaseKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      hasStripeKey: !!process.env.STRIPE_SECRET_KEY,
      hasWebhookSecret: !!process.env.STRIPE_WEBHOOK_SECRET,
    });
    return res.status(500).json({ error: 'Server configuration error' });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const sig = req.headers['stripe-signature'] as string;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const stripe = getStripe();

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
  const metadata = session.metadata;

  // Route to appropriate handler based on metadata type
  if (metadata?.type === 'credit_purchase') {
    await handleCreditPurchase(session, metadata as unknown as CreditPurchaseMetadata);
    return;
  }

  if (metadata?.type === 'session_purchase') {
    await handleSessionPurchase(session, metadata as unknown as SessionPurchaseMetadata);
    return;
  }

  // Legacy: Handle subscription-based checkout (backward compatibility)
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

// =============================================================================
// NEW CREDIT SYSTEM HANDLERS
// =============================================================================

/**
 * Handle credit package purchase
 * Creates credit_purchase record and updates parent_credits balance
 */
async function handleCreditPurchase(
  session: Stripe.Checkout.Session,
  metadata: CreditPurchaseMetadata
) {
  const supabase = getSupabase();
  const { firebase_uid, package_type, credits } = metadata;
  const creditsNum = parseInt(credits, 10);

  // Get price paid from session
  const pricePaid = (session.amount_total || 0) / 100; // Convert from cents

  // Calculate expiry date (12 months from now)
  const expiresAt = new Date();
  expiresAt.setMonth(expiresAt.getMonth() + 12);

  // Ensure parent_credits record exists
  const { data: existingCredits } = await supabase
    .from('parent_credits')
    .select('id, total_credits')
    .eq('firebase_uid', firebase_uid)
    .single();

  const currentBalance = existingCredits?.total_credits || 0;

  if (!existingCredits) {
    // Create parent_credits record
    const { error: createError } = await supabase
      .from('parent_credits')
      .insert({
        firebase_uid,
        total_credits: creditsNum,
      });

    if (createError) {
      console.error('Failed to create parent_credits:', createError);
      throw new Error(`Failed to create credit account: ${createError.message}`);
    }
  } else {
    // Update existing balance
    const { error: updateError } = await supabase
      .from('parent_credits')
      .update({
        total_credits: currentBalance + creditsNum,
      })
      .eq('firebase_uid', firebase_uid);

    if (updateError) {
      console.error('Failed to update parent_credits:', updateError);
      throw new Error(`Failed to update credit balance: ${updateError.message}`);
    }
  }

  // Create credit_purchase record
  const { error: purchaseError } = await supabase
    .from('credit_purchases')
    .insert({
      firebase_uid,
      package_type: package_type as CreditPackageType,
      credits_purchased: creditsNum,
      price_paid: pricePaid,
      currency: session.currency || 'cad',
      stripe_payment_intent_id: session.payment_intent as string,
      stripe_checkout_session_id: session.id,
      expires_at: expiresAt.toISOString(),
      credits_remaining: creditsNum,
      status: 'active',
    });

  if (purchaseError) {
    console.error('Failed to create credit_purchase:', purchaseError);
    throw new Error(`Failed to record purchase: ${purchaseError.message}`);
  }

  // Create notification for user
  await supabase
    .from('notifications')
    .insert({
      user_id: firebase_uid,
      user_type: 'parent',
      type: 'payment_confirmed',
      title: 'Credits Purchased',
      message: `${creditsNum} credit(s) have been added to your account. They expire on ${expiresAt.toLocaleDateString()}.`,
      priority: 'normal',
      data: {
        credits: creditsNum,
        package_type,
        expires_at: expiresAt.toISOString(),
      },
    });

  // Get parent email for admin notification
  const { data: parentReg } = await supabase
    .from('registrations')
    .select('parent_email')
    .eq('firebase_uid', firebase_uid)
    .limit(1)
    .single();

  // Notify admins about credit purchase
  await supabase
    .from('notifications')
    .insert({
      user_id: 'admin',
      user_type: 'admin',
      type: 'payment_received',
      title: 'Credits Purchased',
      message: `${parentReg?.parent_email || 'A parent'} purchased ${creditsNum} credits (${CREDIT_PRICING[package_type].priceFormatted})`,
      priority: 'normal',
      data: {
        firebase_uid,
        credits: creditsNum,
        package_type,
        price_paid: pricePaid,
        parent_email: parentReg?.parent_email,
      },
      action_url: '/admin',
    });

  // Send n8n webhooks for GHL (fire and forget) - dynamic import to prevent function crash
  try {
    const { sendCreditsPurchased, sendContactUpdated, createMinimalContact } = await import('./_lib/n8nWebhook');

    // Get parent contact info
    const { data: registration } = await supabase
      .from('registrations')
      .select('form_data, parent_email')
      .eq('firebase_uid', firebase_uid)
      .limit(1)
      .single();

    if (registration) {
      const formData = registration.form_data || {};
      const contact = createMinimalContact(
        firebase_uid,
        registration.parent_email || formData.parentEmail || '',
        formData.parentPhone || '',
        formData.parentFullName || '',
        formData.communicationLanguage || 'English'
      );

      const newBalance = currentBalance + creditsNum;

      // Send credits_purchased webhook
      await sendCreditsPurchased(contact, {
        action: 'purchased',
        amount: creditsNum,
        new_balance: newBalance,
        package_type,
        price_paid: pricePaid,
        expires_at: expiresAt.toISOString(),
      });

      // Send contact_updated with payment info
      const paymentInfo = {
        total_spent: pricePaid,
        credits_purchased: creditsNum,
        last_purchase_date: new Date().toISOString().split('T')[0],
      };
      await sendContactUpdated(contact, paymentInfo);
    }
  } catch (webhookError) {
    // Fire and forget - just log the error
    console.error('[n8n] Credit purchase webhook error:', webhookError);
  }
}

/**
 * Handle direct session purchase (Sunday, Private, Semi-Private)
 * Creates booking record with payment info
 */
async function handleSessionPurchase(
  session: Stripe.Checkout.Session,
  metadata: SessionPurchaseMetadata
) {
  const supabase = getSupabase();
  const { firebase_uid, registration_id, session_type, session_date, time_slot } = metadata;

  // Get price paid from session
  const pricePaid = (session.amount_total || 0) / 100; // Convert from cents

  // Check for existing booking (prevent duplicates from webhook retries)
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
    // Booking already exists, just update payment info if needed
    await supabase
      .from('session_bookings')
      .update({
        stripe_payment_intent_id: session.payment_intent as string,
        price_paid: pricePaid,
      })
      .eq('id', existingBooking.id);
    return;
  }

  // Create booking record
  const { error: bookingError } = await supabase
    .from('session_bookings')
    .insert({
      firebase_uid,
      registration_id,
      session_type: session_type as SessionType,
      session_date,
      time_slot,
      credits_used: 0, // Direct purchase, no credits used
      price_paid: pricePaid,
      stripe_payment_intent_id: session.payment_intent as string,
      is_recurring: false,
      status: 'booked',
    });

  if (bookingError) {
    console.error('Failed to create session booking:', bookingError);
    throw new Error(`Failed to create booking: ${bookingError.message}`);
  }

  // Get player name for notification
  const { data: registration } = await supabase
    .from('registrations')
    .select('form_data')
    .eq('id', registration_id)
    .single();

  const playerName = registration?.form_data?.playerFullName || 'Your child';

  // Create notification
  const sessionTypeDisplay = {
    sunday: 'Sunday Ice Practice',
    private: 'Private Training',
    semi_private: 'Semi-Private Training',
  }[session_type] || session_type;

  await supabase
    .from('notifications')
    .insert({
      user_id: firebase_uid,
      user_type: 'parent',
      type: 'sunday_booking',
      title: 'Session Booked',
      message: `${playerName}'s ${sessionTypeDisplay} on ${session_date} at ${time_slot} has been confirmed.`,
      priority: 'normal',
      data: {
        registration_id,
        session_type,
        session_date,
        time_slot,
        price_paid: pricePaid,
      },
    });

  // Send n8n webhook for GHL (fire and forget) - dynamic import to prevent function crash
  try {
    const { sendBookingConfirmed, createMinimalContact } = await import('./_lib/n8nWebhook');

    // Get parent contact info from any registration
    const { data: parentReg } = await supabase
      .from('registrations')
      .select('form_data, parent_email')
      .eq('firebase_uid', firebase_uid)
      .limit(1)
      .single();

    if (parentReg) {
      const formData = parentReg.form_data || {};
      const contact = createMinimalContact(
        firebase_uid,
        parentReg.parent_email || formData.parentEmail || '',
        formData.parentPhone || '',
        formData.parentFullName || '',
        formData.communicationLanguage || 'English'
      );

      await sendBookingConfirmed(contact, {
        id: '', // No booking ID available here since we didn't select it
        player_name: playerName,
        session_type,
        session_date,
        time_slot,
        price_paid: pricePaid,
      });
    }
  } catch (webhookError) {
    console.error('[n8n] Session booking webhook error:', webhookError);
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
