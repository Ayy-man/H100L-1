import type { VercelRequest, VercelResponse } from '@vercel/node';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

// Initialize Stripe with secret key from environment
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-11-20.acacia',
});

// Initialize Supabase
const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface SubscriptionRequest {
  paymentMethodId: string;
  registrationId: string;
  customerEmail: string;
  customerName: string;
  programType: 'group' | 'private' | 'semi-private';
  frequency: '1x' | '2x' | 'one-time';
}

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
      paymentMethodId,
      registrationId,
      customerEmail,
      customerName,
      programType,
      frequency,
    } = req.body as SubscriptionRequest;

    // Validate required fields
    if (!paymentMethodId || !registrationId || !customerEmail || !programType) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Step 1: Create or retrieve Stripe customer
    let customer: Stripe.Customer;

    // Check if customer already exists by email
    const existingCustomers = await stripe.customers.list({
      email: customerEmail,
      limit: 1,
    });

    if (existingCustomers.data.length > 0) {
      customer = existingCustomers.data[0];

      // Attach payment method if not already attached
      await stripe.paymentMethods.attach(paymentMethodId, {
        customer: customer.id,
      });

      // Set as default payment method
      await stripe.customers.update(customer.id, {
        invoice_settings: {
          default_payment_method: paymentMethodId,
        },
      });
    } else {
      // Create new customer
      customer = await stripe.customers.create({
        email: customerEmail,
        name: customerName,
        payment_method: paymentMethodId,
        invoice_settings: {
          default_payment_method: paymentMethodId,
        },
        metadata: {
          registrationId,
          programType,
        },
      });
    }

    // Step 2: Determine pricing based on program type
    const priceId = getPriceId(programType, frequency);

    if (!priceId) {
      return res.status(400).json({
        error: `Invalid program type or frequency: ${programType} ${frequency}`
      });
    }

    let subscriptionId = null;
    let paymentIntentId = null;

    // Step 3: Create subscription or one-time payment
    if (frequency === 'one-time') {
      // One-time payment for private training
      const paymentIntent = await stripe.paymentIntents.create({
        amount: getPriceAmount(programType, frequency),
        currency: 'cad',
        customer: customer.id,
        payment_method: paymentMethodId,
        off_session: true,
        confirm: true,
        description: `${programType} training - one-time session`,
        metadata: {
          registrationId,
          programType,
          frequency,
        },
      });

      paymentIntentId = paymentIntent.id;

      // Update Supabase with payment info
      await supabase
        .from('registrations')
        .update({
          stripe_customer_id: customer.id,
          payment_status: paymentIntent.status === 'succeeded' ? 'paid' : 'pending',
          updated_at: new Date().toISOString(),
        })
        .eq('id', registrationId);

      return res.status(200).json({
        success: true,
        customerId: customer.id,
        paymentIntentId,
        status: paymentIntent.status,
      });
    } else {
      // Create recurring subscription
      const subscription = await stripe.subscriptions.create({
        customer: customer.id,
        items: [{ price: priceId }],
        payment_behavior: 'default_incomplete',
        payment_settings: {
          payment_method_types: ['card'],
          save_default_payment_method: 'on_subscription',
        },
        expand: ['latest_invoice.payment_intent'],
        metadata: {
          registrationId,
          programType,
          frequency,
        },
      });

      subscriptionId = subscription.id;

      // Update Supabase with subscription info
      await supabase
        .from('registrations')
        .update({
          stripe_customer_id: customer.id,
          stripe_subscription_id: subscriptionId,
          payment_status: subscription.status === 'active' ? 'active' : 'pending',
          updated_at: new Date().toISOString(),
        })
        .eq('id', registrationId);

      return res.status(200).json({
        success: true,
        customerId: customer.id,
        subscriptionId,
        status: subscription.status,
      });
    }
  } catch (error: any) {
    console.error('Subscription creation error:', error);

    return res.status(500).json({
      error: error.message || 'Failed to create subscription',
      type: error.type,
    });
  }
}

// Helper function to get Stripe Price ID based on program
function getPriceId(programType: string, frequency: string): string | null {
  // TODO: Replace these with your actual Stripe Price IDs
  // You need to create these in your Stripe Dashboard first
  const priceMap: Record<string, string> = {
    'group-1x': process.env.STRIPE_PRICE_GROUP_1X || '',
    'group-2x': process.env.STRIPE_PRICE_GROUP_2X || '',
    'private-1x': process.env.STRIPE_PRICE_PRIVATE_1X || '',
    'private-2x': process.env.STRIPE_PRICE_PRIVATE_2X || '',
    'semi-private': process.env.STRIPE_PRICE_SEMI_PRIVATE || '',
  };

  const key = frequency === 'one-time' ? null : `${programType}-${frequency}`;
  return key ? priceMap[key] : null;
}

// Helper function to get price amount for one-time payments
function getPriceAmount(programType: string, frequency: string): number {
  // Amounts in cents (CAD)
  if (programType === 'private' && frequency === 'one-time') {
    return 8999; // $89.99
  }
  return 0;
}
