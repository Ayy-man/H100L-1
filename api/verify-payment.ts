import type { VercelRequest, VercelResponse } from '@vercel/node';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

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

// Group training capacity
const MAX_GROUP_CAPACITY = 6;

/**
 * Check if slot is still available before confirming payment
 * This is the CRITICAL final check to prevent double-booking
 */
async function validateSlotAvailability(
  registrationId: string,
  formData: any
): Promise<{ valid: boolean; message: string }> {
  const programType = formData?.programType;

  if (!programType) {
    return { valid: true, message: 'No program type - skipping validation' };
  }

  // Fetch all CONFIRMED registrations (succeeded or verified) - NOT including the current one
  const { data: confirmedBookings, error } = await getSupabase()
    .from('registrations')
    .select('id, form_data')
    .in('payment_status', ['succeeded', 'verified'])
    .neq('id', registrationId);

  if (error) {
    console.error('Error checking slot availability:', error);
    // Don't block payment on query error, log and continue
    return { valid: true, message: 'Query error - allowing payment' };
  }

  if (programType === 'group') {
    const selectedDays = formData?.groupSelectedDays || [];

    for (const day of selectedDays) {
      const dayLower = day.toLowerCase();

      // Count how many confirmed group registrations have this day
      const bookedCount = confirmedBookings?.filter(b => {
        if (b.form_data?.programType !== 'group') return false;
        const days = b.form_data?.groupSelectedDays || [];
        return days.map((d: string) => d.toLowerCase()).includes(dayLower);
      }).length || 0;

      if (bookedCount >= MAX_GROUP_CAPACITY) {
        return {
          valid: false,
          message: `Group training on ${day} is now full (${bookedCount}/${MAX_GROUP_CAPACITY} spots taken). Your payment will be refunded.`
        };
      }
    }
  }

  if (programType === 'private') {
    const selectedDays = formData?.privateSelectedDays || [];
    const timeSlot = formData?.privateTimeSlot;

    if (timeSlot) {
      for (const day of selectedDays) {
        const dayLower = day.toLowerCase();

        // Check if any confirmed private or semi-private booking has this exact day+time
        const isBlocked = confirmedBookings?.some(b => {
          const isPrivate = b.form_data?.programType === 'private';
          const isSemiPrivate = b.form_data?.programType === 'semi-private';

          if (isPrivate) {
            const days = b.form_data?.privateSelectedDays || [];
            return days.map((d: string) => d.toLowerCase()).includes(dayLower) &&
                   b.form_data?.privateTimeSlot === timeSlot;
          }

          if (isSemiPrivate) {
            const days = b.form_data?.semiPrivateAvailability || [];
            const semiTime = b.form_data?.semiPrivateTimeSlot ||
              (b.form_data?.semiPrivateTimeWindows && b.form_data?.semiPrivateTimeWindows[0]);
            return days.map((d: string) => d.toLowerCase()).includes(dayLower) &&
                   semiTime === timeSlot;
          }

          return false;
        });

        if (isBlocked) {
          return {
            valid: false,
            message: `Private training slot on ${day} at ${timeSlot} is no longer available. Your payment will be refunded.`
          };
        }
      }
    }
  }

  if (programType === 'semi-private') {
    const selectedDays = formData?.semiPrivateAvailability || [];
    const timeSlot = formData?.semiPrivateTimeSlot ||
      (formData?.semiPrivateTimeWindows && formData?.semiPrivateTimeWindows[0]);

    if (timeSlot) {
      for (const day of selectedDays) {
        const dayLower = day.toLowerCase();

        // Check if any confirmed private or semi-private booking has this exact day+time
        const isBlocked = confirmedBookings?.some(b => {
          const isPrivate = b.form_data?.programType === 'private';
          const isSemiPrivate = b.form_data?.programType === 'semi-private';

          if (isPrivate) {
            const days = b.form_data?.privateSelectedDays || [];
            return days.map((d: string) => d.toLowerCase()).includes(dayLower) &&
                   b.form_data?.privateTimeSlot === timeSlot;
          }

          if (isSemiPrivate) {
            const days = b.form_data?.semiPrivateAvailability || [];
            const semiTime = b.form_data?.semiPrivateTimeSlot ||
              (b.form_data?.semiPrivateTimeWindows && b.form_data?.semiPrivateTimeWindows[0]);
            return days.map((d: string) => d.toLowerCase()).includes(dayLower) &&
                   semiTime === timeSlot;
          }

          return false;
        });

        if (isBlocked) {
          return {
            valid: false,
            message: `Semi-private training slot on ${day} at ${timeSlot} is no longer available. Your payment will be refunded.`
          };
        }
      }
    }
  }

  return { valid: true, message: 'Slot is available' };
}

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

    // CRITICAL: Fetch registration and validate slot availability BEFORE confirming payment
    const { data: registration, error: fetchError } = await getSupabase()
      .from('registrations')
      .select('*')
      .eq('id', registrationId)
      .single();

    if (fetchError || !registration) {
      console.error(`Failed to fetch registration ${registrationId}:`, fetchError);
      return res.status(404).json({
        error: 'Registration not found',
        details: fetchError?.message
      });
    }

    // Check if slot is still available (prevents race condition double-booking)
    const slotValidation = await validateSlotAvailability(registrationId, registration.form_data);

    if (!slotValidation.valid) {
      console.error(`❌ Slot no longer available for registration ${registrationId}: ${slotValidation.message}`);

      // Mark registration as failed due to slot unavailability
      await getSupabase()
        .from('registrations')
        .update({
          payment_status: 'slot_unavailable',
          updated_at: new Date().toISOString(),
        })
        .eq('id', registrationId);

      // TODO: Trigger Stripe refund here if needed
      // await stripe.refunds.create({ payment_intent: session.payment_intent });

      return res.status(409).json({
        error: 'Slot no longer available',
        message: slotValidation.message,
        refundRequired: true
      });
    }

    // Update registration in database
    const { data, error } = await getSupabase()
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
