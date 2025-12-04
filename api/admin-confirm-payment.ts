import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';


// ============================================================
// INLINED NOTIFICATION HELPER (to avoid Vercel bundling issues)
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

async function notifyPaymentConfirmed(params: {
  parentUserId: string;
  playerName: string;
  amount?: string;
  registrationId: string;
  confirmedBy: string;
}) {
  const { parentUserId, playerName, amount, registrationId, confirmedBy } = params;

  await createNotification({
    userId: parentUserId,
    userType: 'parent',
    type: 'payment_confirmed',
    title: 'Payment Confirmed',
    message: `Your payment for ${playerName}'s training has been verified${amount ? ` (${amount})` : ''}. Training access is now active.`,
    priority: 'high',
    data: {
      registration_id: registrationId,
      player_name: playerName,
      amount,
      confirmed_by: confirmedBy
    },
    actionUrl: '/dashboard'
  });

  await notifyAdmins({
    type: 'payment_confirmed',
    title: 'Payment Manually Confirmed',
    message: `Payment confirmed for ${playerName} by ${confirmedBy}.`,
    priority: 'low',
    data: {
      registration_id: registrationId,
      player_name: playerName,
      confirmed_by: confirmedBy
    }
  });
}

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
 * Admin Confirm Payment API
 *
 * Allows admin users to manually confirm a payment.
 * This is used for:
 * - Offline payments (cash, e-transfer)
 * - Payments made outside normal flow
 * - Manual verification from Stripe
 * - Error overrides
 *
 * The "manually_confirmed" flag indicates owner verification,
 * which takes precedence over automatic payment status.
 */
export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { registrationId, adminEmail = 'admin', reason } = req.body;

    // Validate inputs
    if (!registrationId) {
      return res.status(400).json({ error: 'Missing registration ID' });
    }

    // Verify registration exists
    const { data: registration, error: fetchError } = await getSupabase()
      .from('registrations')
      .select('*')
      .eq('id', registrationId)
      .single();

    if (fetchError || !registration) {
      return res.status(404).json({ error: 'Registration not found' });
    }

    // Update registration with manual confirmation
    // Set status to 'verified' - one step above 'succeeded'
    const { data, error } = await getSupabase()
      .from('registrations')
      .update({
        payment_status: 'verified',
        manually_confirmed: true,
        manually_confirmed_by: adminEmail,
        manually_confirmed_at: new Date().toISOString(),
        manually_confirmed_reason: reason || 'Admin override',
        updated_at: new Date().toISOString(),
      })
      .eq('id', registrationId)
      .select()
      .single();

    if (error) {
      console.error(`Failed to confirm payment for ${registrationId}:`, error);
      return res.status(500).json({
        error: 'Database update failed',
        details: error.message
      });
    }


    // Send notification to parent
    try {
      if (registration.firebase_uid) {
        await notifyPaymentConfirmed({
          parentUserId: registration.firebase_uid,
          playerName: registration.form_data?.playerFullName || 'Player',
          registrationId,
          confirmedBy: adminEmail
        });
      }
    } catch (notificationError) {
      // Don't fail the request if notification fails
      console.error('Error sending payment confirmation notification:', notificationError);
    }

    return res.status(200).json({
      success: true,
      registration: {
        id: data.id,
        payment_status: data.payment_status,
        manually_confirmed: data.manually_confirmed,
        manually_confirmed_by: data.manually_confirmed_by,
        manually_confirmed_at: data.manually_confirmed_at,
      },
    });
  } catch (error: any) {
    console.error('Admin confirm payment error:', error);

    return res.status(500).json({
      error: error.message || 'Failed to confirm payment',
    });
  }
}
