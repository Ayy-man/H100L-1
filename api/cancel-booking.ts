import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
// n8nWebhook imported dynamically to prevent function crash if module fails to load

// Inline types and constants (Vercel bundling doesn't resolve ../types/credits)
const CANCELLATION_WINDOW_HOURS = 24;

interface CancelBookingRequest {
  booking_id: string;
  firebase_uid: string;
  reason?: string;
}

interface CancelBookingResponse {
  success: boolean;
  credits_refunded: number;
  credits_remaining: number;
  message: string;
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
    console.error('[cancel-booking] Missing env vars:', {
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
    const { booking_id, firebase_uid, reason } = req.body as CancelBookingRequest;

    // Validate required fields
    if (!booking_id || !firebase_uid) {
      return res.status(400).json({
        error: 'Missing required fields: booking_id, firebase_uid',
      });
    }

    const supabase = getSupabase();

    // Get the booking
    const { data: booking, error: bookingError } = await supabase
      .from('session_bookings')
      .select('*')
      .eq('id', booking_id)
      .eq('firebase_uid', firebase_uid)
      .single();

    if (bookingError || !booking) {
      return res.status(404).json({
        error: 'Booking not found or does not belong to this user',
      });
    }

    // Check if already cancelled
    if (booking.status === 'cancelled') {
      return res.status(400).json({
        error: 'This booking has already been cancelled',
      });
    }

    // Check if session already happened
    if (booking.status === 'attended' || booking.status === 'no_show') {
      return res.status(400).json({
        error: 'Cannot cancel a session that has already occurred',
      });
    }

    // Check if cancellation is within the refund window (24 hours before)
    const sessionDateTime = new Date(`${booking.session_date}T${convertTimeToISO(booking.time_slot)}`);
    const now = new Date();
    const hoursUntilSession = (sessionDateTime.getTime() - now.getTime()) / (1000 * 60 * 60);
    const canRefund = hoursUntilSession >= CANCELLATION_WINDOW_HOURS;

    // Update booking status
    const { error: updateError } = await supabase
      .from('session_bookings')
      .update({
        status: 'cancelled',
        cancelled_at: new Date().toISOString(),
        cancellation_reason: reason || (canRefund ? 'User cancelled (refund eligible)' : 'User cancelled (late cancellation)'),
      })
      .eq('id', booking_id);

    if (updateError) {
      console.error('Error cancelling booking:', updateError);
      return res.status(500).json({ error: 'Failed to cancel booking' });
    }

    let creditsRefunded = 0;

    // Refund credit if within window and credits were used
    if (canRefund && booking.credits_used > 0) {
      if (booking.credit_purchase_id) {
        // Refund to original purchase AND parent_credits via RPC
        const { error: refundError } = await supabase.rpc('refund_credit', {
          p_firebase_uid: firebase_uid,
          p_purchase_id: booking.credit_purchase_id,
          p_credits_to_refund: booking.credits_used,
        });

        if (refundError) {
          console.error('Error refunding credit via RPC:', refundError);
          // Don't fail the cancellation, but note the refund failed
        } else {
          creditsRefunded = booking.credits_used;
        }
      } else {
        // No purchase_id (admin-added credits) - directly update parent_credits
        // First get current balance (use maybeSingle to handle missing row)
        const { data: currentCredits, error: fetchError } = await supabase
          .from('parent_credits')
          .select('total_credits')
          .eq('firebase_uid', firebase_uid)
          .maybeSingle();

        if (fetchError) {
          console.error('Error fetching current credits:', fetchError);
        } else {
          const currentBalance = currentCredits?.total_credits || 0;
          const newBalance = currentBalance + booking.credits_used;

          // Use upsert to handle both existing and missing rows
          const { error: upsertError } = await supabase
            .from('parent_credits')
            .upsert(
              { firebase_uid, total_credits: newBalance },
              { onConflict: 'firebase_uid' }
            );

          if (upsertError) {
            console.error('Error refunding credit directly:', upsertError);
          } else {
            creditsRefunded = booking.credits_used;
            console.log(`[cancel-booking] Refunded ${creditsRefunded} credit(s) directly to parent_credits (no purchase_id)`);
          }
        }
      }
    }

    // Get updated credit balance
    const { data: updatedCredits } = await supabase
      .from('parent_credits')
      .select('total_credits')
      .eq('firebase_uid', firebase_uid)
      .single();

    let message: string;
    if (canRefund && creditsRefunded > 0) {
      message = `Booking cancelled. ${creditsRefunded} credit(s) have been refunded.`;
    } else if (!canRefund && booking.credits_used > 0) {
      message = `Booking cancelled. Cancellation was less than ${CANCELLATION_WINDOW_HOURS} hours before the session, so credits cannot be refunded.`;
    } else {
      message = 'Booking cancelled successfully.';
    }

    // Send n8n webhook (fire and forget) - dynamic import to prevent function crash
    try {
      const { sendBookingCancelled, createMinimalContact } = await import('./_lib/n8nWebhook');

      // Get parent and player info
      const { data: regData } = await supabase
        .from('registrations')
        .select('form_data, parent_email')
        .eq('id', booking.registration_id)
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

        await sendBookingCancelled(
          contact,
          {
            id: booking_id,
            player_name: formData.playerFullName || 'Your child',
            session_type: booking.session_type,
            session_date: booking.session_date,
            time_slot: booking.time_slot,
            credits_used: booking.credits_used,
          },
          creditsRefunded
        );
      }
    } catch (webhookError) {
      console.error('[n8n] Cancellation webhook error:', webhookError);
    }

    const response: CancelBookingResponse = {
      success: true,
      credits_refunded: creditsRefunded,
      credits_remaining: updatedCredits?.total_credits || 0,
      message,
    };

    return res.status(200).json(response);
  } catch (error: any) {
    console.error('Cancel booking error:', error);
    return res.status(500).json({
      error: 'Failed to cancel booking',
    });
  }
}

/**
 * Convert time slot string (e.g., "5:45 PM") to ISO time format
 */
function convertTimeToISO(timeSlot: string): string {
  const match = timeSlot.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
  if (!match) return '00:00:00';

  let hours = parseInt(match[1], 10);
  const minutes = match[2];
  const period = match[3].toUpperCase();

  if (period === 'PM' && hours !== 12) {
    hours += 12;
  } else if (period === 'AM' && hours === 12) {
    hours = 0;
  }

  return `${hours.toString().padStart(2, '0')}:${minutes}:00`;
}
