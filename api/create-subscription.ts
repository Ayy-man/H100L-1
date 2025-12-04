import type { VercelRequest, VercelResponse } from '@vercel/node';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';


// ============================================================
// INLINED NOTIFICATION HELPERS (to avoid Vercel bundling issues)
// ============================================================

interface CreateNotificationParams {
  userId: string;
  userType: 'parent' | 'admin';
  type: string;
  title: string;
  message: string;
  priority?: 'low' | 'normal' | 'high' | 'urgent';
  data?: Record<string, any>;
  actionUrl?: string;
}

async function createNotification(params: CreateNotificationParams) {
  try {
    const supabase = createClient(
      process.env.VITE_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { error } = await supabase
      .from('notifications')
      .insert({
        user_id: params.userId,
        user_type: params.userType,
        type: params.type,
        title: params.title,
        message: params.message,
        priority: params.priority || 'normal',
        data: params.data || null,
        action_url: params.actionUrl || null,
      });

    if (error) {
      console.error('Error creating notification:', error);
    }
  } catch (err) {
    console.error('Exception creating notification:', err);
  }
}

async function notifyAdmins(params: Omit<CreateNotificationParams, 'userId' | 'userType'>) {
  return createNotification({
    ...params,
    userId: 'admin',
    userType: 'admin'
  });
}

async function notifyNewRegistration(params: {
  playerName: string;
  playerCategory: string;
  programType: string;
  parentEmail: string;
  registrationId: string;
}) {
  const { playerName, playerCategory, programType, parentEmail, registrationId } = params;

  await notifyAdmins({
    type: 'system',
    title: 'New Registration',
    message: `${playerName} (${playerCategory}) registered for ${programType} training. Contact: ${parentEmail}`,
    priority: 'normal',
    data: {
      registration_id: registrationId,
      player_name: playerName,
      player_category: playerCategory,
      program_type: programType,
      parent_email: parentEmail
    },
    actionUrl: '/admin'
  });
}

// Initialize Stripe with secret key from environment
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

interface SubscriptionRequest {
  paymentMethodId: string;
  registrationId: string;
  customerEmail: string;
  customerName: string;
  programType: 'group' | 'private' | 'semi-private';
  frequency: '1x' | '2x' | '1x/week' | '2x/week' | '3x/week' | 'monthly' | 'one-time';
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
    // Private sessions are sold by unity (one session at a time)
    if (programType === 'private') {
      // One-time payment for private training using Stripe Price
      // Create an invoice with the price and pay it immediately
      // Create invoice item with the price (result stored for audit trail, not used directly)
      await stripe.invoiceItems.create({
        customer: customer.id,
        price: priceId,
        metadata: {
          registrationId,
          programType,
        },
      });

      const invoice = await stripe.invoices.create({
        customer: customer.id,
        auto_advance: true, // Auto-finalize
        collection_method: 'charge_automatically',
        default_payment_method: paymentMethodId,
        metadata: {
          registrationId,
          programType,
          frequency: 'one-time',
        },
      });

      // Finalize and pay the invoice
      await stripe.invoices.finalizeInvoice(invoice.id);
      const paidInvoice = await stripe.invoices.pay(invoice.id);

      paymentIntentId = paidInvoice.payment_intent as string;

      // Update Supabase with payment info
      await getSupabase()
        .from('registrations')
        .update({
          stripe_customer_id: customer.id,
          payment_status: paidInvoice.status === 'paid' ? 'succeeded' : 'pending',
          updated_at: new Date().toISOString(),
        })
        .eq('id', registrationId);

      // Notify admin about new private session registration
      if (paidInvoice.status === 'paid') {
        try {
          const { data: regData } = await getSupabase()
            .from('registrations')
            .select('form_data')
            .eq('id', registrationId)
            .single();

          if (regData?.form_data) {
            const formData = regData.form_data;
            await notifyNewRegistration({
              playerName: formData.playerFullName || 'Unknown Player',
              playerCategory: formData.playerCategory || 'Unknown',
              programType: 'Private Training (Single Session)',
              parentEmail: formData.parentEmail || customerEmail,
              registrationId,
            });
          }
        } catch (notifyError) {
          console.error('Failed to send new registration notification:', notifyError);
        }
      }

      return res.status(200).json({
        success: true,
        customerId: customer.id,
        invoiceId: paidInvoice.id,
        paymentIntentId,
        status: paidInvoice.status,
      });
    } else {
      // Create recurring subscription and charge immediately
      const subscription = await stripe.subscriptions.create({
        customer: customer.id,
        items: [{ price: priceId }],
        default_payment_method: paymentMethodId,
        expand: ['latest_invoice.payment_intent'],
        metadata: {
          registrationId,
          programType,
          frequency,
        },
      });

      subscriptionId = subscription.id;

      // Get the payment status from the latest invoice
      const invoice = subscription.latest_invoice as Stripe.Invoice;
      const paymentIntent = invoice?.payment_intent as Stripe.PaymentIntent;
      // FIXED: Use 'succeeded' instead of 'active' to match expected payment statuses
      const paymentStatus = paymentIntent?.status === 'succeeded'
        ? 'succeeded'
        : subscription.status === 'active'
        ? 'succeeded'
        : 'pending';

      // Update Supabase with subscription info
      await getSupabase()
        .from('registrations')
        .update({
          stripe_customer_id: customer.id,
          stripe_subscription_id: subscriptionId,
          payment_status: paymentStatus,
          updated_at: new Date().toISOString(),
        })
        .eq('id', registrationId);

      // Notify admin about new registration
      if (paymentStatus === 'succeeded') {
        try {
          // Get registration details for notification
          const { data: regData } = await getSupabase()
            .from('registrations')
            .select('form_data')
            .eq('id', registrationId)
            .single();

          if (regData?.form_data) {
            const formData = regData.form_data;
            await notifyNewRegistration({
              playerName: formData.playerFullName || 'Unknown Player',
              playerCategory: formData.playerCategory || 'Unknown',
              programType: programType === 'group'
                ? `Group Training (${frequency})`
                : programType === 'private'
                ? `Private Training (${frequency})`
                : 'Semi-Private Training',
              parentEmail: formData.parentEmail || customerEmail,
              registrationId,
            });
          }
        } catch (notifyError) {
          console.error('Failed to send new registration notification:', notifyError);
          // Don't fail the whole request for notification errors
        }
      }

      // For semi-private, add player to unpaired list for matching
      if (programType === 'semi-private' && paymentStatus === 'succeeded') {
        // Get registration details for unpaired entry
        const { data: registration } = await getSupabase()
          .from('registrations')
          .select('form_data')
          .eq('id', registrationId)
          .single();

        if (registration?.form_data) {
          const formData = registration.form_data;
          await getSupabase()
            .from('unpaired_semi_private')
            .upsert({
              registration_id: registrationId,
              player_name: formData.playerFullName,
              player_category: formData.playerCategory,
              age_category: formData.playerCategory,
              preferred_days: formData.semiPrivateAvailability || [],
              preferred_time_slots: formData.semiPrivateTimeSlot
                ? [formData.semiPrivateTimeSlot]
                : (formData.semiPrivateTimeWindows || []),
              parent_email: formData.parentEmail,
              parent_name: formData.parentFullName,
              status: 'waiting',
              unpaired_since_date: new Date().toISOString().split('T')[0]
            }, {
              onConflict: 'registration_id'
            });
        }
      }

      return res.status(200).json({
        success: true,
        customerId: customer.id,
        subscriptionId,
        status: paymentStatus,
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
  const priceMap: Record<string, string | undefined> = {
    'group-1x': process.env.VITE_STRIPE_PRICE_GROUP_1X,
    'group-2x': process.env.VITE_STRIPE_PRICE_GROUP_2X,
    'private-one-time': process.env.VITE_STRIPE_PRICE_PRIVATE_SESSION, // Single private session (sold by unity)
    'semi-private-monthly': process.env.VITE_STRIPE_PRICE_SEMI_PRIVATE,
  };

  // Private sessions are sold by unity (one-time payments)
  if (programType === 'private') {
    return priceMap['private-one-time'] || null;
  }

  // Handle semi-private which doesn't have frequency in the same way
  if (programType === 'semi-private') {
    return priceMap['semi-private-monthly'];
  }

  const key = `${programType}-${frequency}`;
  return priceMap[key] || null;
}

// Helper function to get price amount for one-time payments
function getPriceAmount(programType: string, frequency: string): number {
  // Amounts in cents (CAD)
  if (programType === 'private' && frequency === 'one-time') {
    return 8999; // $89.99
  }
  return 0;
}
