import type { VercelRequest, VercelResponse } from '@vercel/node';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

console.log('[cancel-subscription] Module loaded');

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
    const { data: registration, error: fetchError } = await getSupabase()
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

    // Calculate the end of paid access (current billing period end)
    const billingPeriodEnd = new Date(canceledSubscription.current_period_end * 1000);

    // Update registration in database
    const { error: updateError } = await getSupabase()
      .from('registrations')
      .update({
        payment_status: 'canceled',
        updated_at: new Date().toISOString(),
      })
      .eq('id', registrationId);

    if (updateError) {
      console.error('Failed to update registration:', updateError);
      return res.status(500).json({ error: 'Failed to update registration' });
    }

    // Cancel all Sunday practice bookings AFTER the billing period end
    // User keeps bookings they've already paid for (during current billing period)
    const { data: canceledBookings, error: bookingError } = await getSupabase()
      .from('sunday_bookings')
      .update({
        booking_status: 'cancelled',
        updated_at: new Date().toISOString(),
      })
      .eq('registration_id', registrationId)
      .eq('booking_status', 'confirmed')
      .gt('booking_date', billingPeriodEnd.toISOString())
      .select();

    if (bookingError) {
      console.error('Failed to cancel future bookings:', bookingError);
      // Don't fail the whole request, just log the error
    }

    const canceledBookingCount = canceledBookings?.length || 0;

    // Send notifications about cancellation
    try {
      const formData = registration.form_data || {};
      const playerName = formData.playerFullName || 'Your child';
      const programType = formData.programType || 'training';

      // Notify parent about cancellation
      await createNotification({
        userId: firebaseUid,
        userType: 'parent',
        type: 'system',
        title: 'Subscription Cancelled',
        message: `Your ${programType} training subscription for ${playerName} has been cancelled. Access will remain active until ${billingPeriodEnd.toLocaleDateString()}.`,
        priority: 'high',
        data: {
          registration_id: registrationId,
          player_name: playerName,
          access_until: billingPeriodEnd.toISOString(),
          canceled_bookings: canceledBookingCount
        },
        actionUrl: '/dashboard'
      });

      // Notify admin about cancellation (churn tracking)
      await notifyAdmins({
        type: 'system',
        title: 'Subscription Cancelled',
        message: `${playerName} (${programType}) has cancelled their subscription. Contact: ${formData.parentEmail || 'N/A'}`,
        priority: 'normal',
        data: {
          registration_id: registrationId,
          player_name: playerName,
          program_type: programType,
          parent_email: formData.parentEmail
        }
      });
    } catch (notifyError) {
      console.error('Failed to send cancellation notifications:', notifyError);
      // Don't fail the whole request for notification errors
    }

    // Return success with cancellation details
    return res.status(200).json({
      success: true,
      message: 'Subscription canceled successfully',
      canceledAt: canceledSubscription.canceled_at,
      currentPeriodEnd: canceledSubscription.current_period_end,
      willCancelAt: billingPeriodEnd.toLocaleDateString(),
      canceledBookings: canceledBookingCount,
    });

  } catch (error: any) {
    console.error('Cancel subscription error:', error);
    return res.status(500).json({
      error: error.message || 'Failed to cancel subscription'
    });
  }
}
