import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
// n8nWebhook imported dynamically to prevent function crash if module fails to load

// Session types and credits
const SESSION_TYPES = ['group', 'sunday', 'private', 'semi_private'] as const;
type SessionType = typeof SESSION_TYPES[number];

const CREDITS_PER_SESSION: Record<SessionType, number> = {
  group: 1,
  sunday: 0,
  private: 0,
  semi_private: 0,
};

const MAX_GROUP_CAPACITY = 6;

function isSessionType(value: string): value is SessionType {
  return SESSION_TYPES.includes(value as SessionType);
}

// Inline Supabase client for Vercel bundling
function getSupabase() {
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error('Missing Supabase environment variables');
  }

  return createClient(url, key);
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // Early env var validation
  if (!process.env.VITE_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('[book-session] Missing env vars:', {
      hasUrl: !!process.env.VITE_SUPABASE_URL,
      hasKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    });
    return res.status(500).json({ error: 'Server configuration error' });
  }

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
      is_recurring = false,
    } = req.body || {};

    // Validate required fields
    if (!firebase_uid || !registration_id || !session_type || !session_date || !time_slot) {
      return res.status(400).json({
        error: 'Missing required fields: firebase_uid, registration_id, session_type, session_date, time_slot',
      });
    }

    // Validate session type
    if (!isSessionType(session_type)) {
      return res.status(400).json({
        error: 'Invalid session_type. Must be "group", "sunday", "private", or "semi_private"',
      });
    }

    // Check if this session type uses credits or direct payment
    const creditsRequired = CREDITS_PER_SESSION[session_type];

    // If no credits required, redirect to purchase-session endpoint
    if (creditsRequired === 0) {
      return res.status(400).json({
        error: `${session_type} sessions are purchased directly. Use /api/purchase-session endpoint.`,
        redirect: '/api/purchase-session',
      });
    }

    const supabase = getSupabase();

    // Verify registration belongs to this user
    const { data: registration, error: regError } = await supabase
      .from('registrations')
      .select('id, firebase_uid')
      .eq('id', registration_id)
      .eq('firebase_uid', firebase_uid)
      .single();

    if (regError || !registration) {
      return res.status(404).json({
        error: 'Registration not found or does not belong to this user',
      });
    }

    // Check slot availability (direct query instead of RPC)
    const { data: currentBookings, error: capacityError } = await supabase
      .from('session_bookings')
      .select('id')
      .eq('session_date', session_date)
      .eq('time_slot', time_slot)
      .eq('session_type', session_type)
      .in('status', ['booked', 'attended']);

    if (capacityError) {
      console.error('Error checking capacity:', capacityError);
      return res.status(500).json({ error: 'Failed to check availability' });
    }

    const bookingCount = currentBookings?.length || 0;
    if (bookingCount >= MAX_GROUP_CAPACITY) {
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
      .maybeSingle();

    if (existingBooking) {
      return res.status(409).json({
        error: 'This child already has a booking for this session',
      });
    }

    // Check credit balance
    const { data: parentCredits, error: creditError } = await supabase
      .from('parent_credits')
      .select('total_credits')
      .eq('firebase_uid', firebase_uid)
      .maybeSingle();

    if (creditError) {
      console.error('Error checking credits:', creditError);
      return res.status(500).json({ error: 'Database error checking credits' });
    }

    const currentCredits = parentCredits?.total_credits || 0;

    if (currentCredits < creditsRequired) {
      return res.status(402).json({
        error: `Insufficient credits. You have ${currentCredits} credit(s), but ${creditsRequired} is required.`,
        credits_required: creditsRequired,
        credits_available: currentCredits,
      });
    }

    // Find oldest active purchase with remaining credits (FIFO)
    const { data: activePurchase } = await supabase
      .from('credit_purchases')
      .select('id, credits_remaining')
      .eq('firebase_uid', firebase_uid)
      .eq('status', 'active')
      .gte('credits_remaining', creditsRequired)
      .gt('expires_at', new Date().toISOString())
      .order('expires_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    let creditPurchaseId: string | null = null;

    if (activePurchase) {
      // Deduct credit from purchase (FIFO)
      const newRemaining = activePurchase.credits_remaining - creditsRequired;
      const { error: deductPurchaseError } = await supabase
        .from('credit_purchases')
        .update({
          credits_remaining: newRemaining,
          status: newRemaining === 0 ? 'exhausted' : 'active',
        })
        .eq('id', activePurchase.id);

      if (deductPurchaseError) {
        console.error('Error deducting from purchase:', deductPurchaseError);
        return res.status(500).json({ error: 'Failed to deduct credit' });
      }
      creditPurchaseId = activePurchase.id;
    }
    // If no active purchase found but parent has credits (e.g., admin-added credits),
    // we still allow booking - just deduct from parent_credits total

    // Update parent total credits
    const { error: updateTotalError } = await supabase
      .from('parent_credits')
      .update({ total_credits: currentCredits - creditsRequired })
      .eq('firebase_uid', firebase_uid);

    if (updateTotalError) {
      console.error('Error updating total credits:', updateTotalError);
      // Rollback the purchase deduction if we did one
      if (activePurchase) {
        await supabase
          .from('credit_purchases')
          .update({
            credits_remaining: activePurchase.credits_remaining,
            status: 'active',
          })
          .eq('id', activePurchase.id);
      }
      return res.status(500).json({ error: 'Failed to update credit balance' });
    }

    // Create the booking
    const { data: booking, error: bookingError } = await supabase
      .from('session_bookings')
      .insert({
        firebase_uid,
        registration_id,
        session_type,
        session_date,
        time_slot,
        credits_used: creditsRequired,
        credit_purchase_id: creditPurchaseId,
        is_recurring,
        status: 'booked',
      })
      .select()
      .single();

    if (bookingError) {
      console.error('Error creating booking:', bookingError);
      // Rollback credit deductions
      if (activePurchase) {
        await supabase
          .from('credit_purchases')
          .update({
            credits_remaining: activePurchase.credits_remaining,
            status: 'active',
          })
          .eq('id', activePurchase.id);
      }
      await supabase
        .from('parent_credits')
        .update({ total_credits: currentCredits })
        .eq('firebase_uid', firebase_uid);
      return res.status(500).json({
        error: 'Failed to create booking. Credit has been refunded.',
      });
    }

    // Send n8n webhooks (fire and forget) - dynamic import to prevent function crash
    const newBalance = currentCredits - creditsRequired;
    try {
      const { sendBookingConfirmed, sendCreditsLow, createMinimalContact } = await import('./_lib/n8nWebhook');

      // Get parent and player info
      const { data: regData } = await supabase
        .from('registrations')
        .select('form_data, parent_email')
        .eq('id', registration_id)
        .single();

      if (regData) {
        const formData = regData.form_data || {};
        const contact = createMinimalContact(
          firebase_uid,
          regData.parent_email || formData.parentEmail || '',
          formData.parentPhone || '',
          formData.parentFullName || '',
          formData.communicationLanguage || 'English'
        );

        // Send booking confirmation
        await sendBookingConfirmed(contact, {
          id: booking.id,
          player_name: formData.playerFullName || 'Your child',
          session_type,
          session_date,
          time_slot,
          credits_used: creditsRequired,
        });

        // Send low credit alert if balance is below 3
        if (newBalance < 3 && newBalance >= 0) {
          await sendCreditsLow(contact, newBalance);
        }
      }
    } catch (webhookError) {
      console.error('[n8n] Booking webhook error:', webhookError);
    }

    return res.status(201).json({
      booking,
      credits_remaining: newBalance,
      message: `Session booked successfully! ${creditsRequired} credit used.`,
    });
  } catch (error: any) {
    console.error('Book session error:', error);
    return res.status(500).json({
      error: error.message || 'Failed to book session',
    });
  }
}
