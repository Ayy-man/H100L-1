import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import {
  sendSessionReminder,
  sendCreditsExpiring,
  createMinimalContact,
} from './_lib/n8nWebhook';

// Inline Supabase client for Vercel bundling
function getSupabase() {
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error('Missing Supabase environment variables');
  }

  return createClient(url, key);
}

/**
 * CRON JOB: Session Reminders & Credit Expiry Alerts
 *
 * This endpoint should be called daily at 2pm EST to:
 * 1. Send session reminders for next-day bookings
 * 2. Send credit expiry warnings for credits expiring in 7 days
 *
 * Vercel CRON config in vercel.json:
 * {
 *   "crons": [{
 *     "path": "/api/cron-session-reminders",
 *     "schedule": "0 19 * * *"  // 2pm EST = 7pm UTC (during EST)
 *   }]
 * }
 */
export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // Allow POST (CRON) and GET (testing)
  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Verify CRON secret (optional but recommended)
  const cronSecret = req.headers['x-cron-secret'] || req.query.secret;
  const expectedSecret = process.env.CRON_SECRET;
  if (expectedSecret && cronSecret !== expectedSecret) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const supabase = getSupabase();
  const stats = {
    reminders_sent: 0,
    expiry_alerts_sent: 0,
    errors: 0,
  };

  try {
    // Calculate tomorrow's date
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowDate = tomorrow.toISOString().split('T')[0];

    // =========================================================================
    // PART 1: SESSION REMINDERS
    // =========================================================================

    // Get all bookings for tomorrow
    const { data: bookings, error: bookingError } = await supabase
      .from('session_bookings')
      .select(`
        id,
        firebase_uid,
        registration_id,
        session_type,
        session_date,
        time_slot,
        registrations!inner (
          form_data,
          parent_email
        )
      `)
      .eq('session_date', tomorrowDate)
      .eq('status', 'booked');

    if (bookingError) {
      console.error('Error fetching bookings:', bookingError);
    } else if (bookings && bookings.length > 0) {
      // Group by firebase_uid to avoid sending multiple webhooks per parent
      const bookingsByParent = new Map<string, typeof bookings>();

      for (const booking of bookings) {
        const existing = bookingsByParent.get(booking.firebase_uid) || [];
        existing.push(booking);
        bookingsByParent.set(booking.firebase_uid, existing);
      }

      // Send reminders for each parent
      for (const [firebaseUid, parentBookings] of bookingsByParent) {
        try {
          // Get parent contact info from first booking
          const firstBooking = parentBookings[0] as any;
          const reg = firstBooking.registrations;
          const formData = reg?.form_data || {};

          const contact = createMinimalContact(
            firebaseUid,
            reg?.parent_email || formData.parentEmail || '',
            formData.parentPhone || '',
            formData.parentFullName || '',
            formData.communicationLanguage || 'English'
          );

          // Send reminder for each booking
          for (const booking of parentBookings) {
            const bookingReg = (booking as any).registrations;
            const bookingFormData = bookingReg?.form_data || {};

            await sendSessionReminder(contact, {
              id: booking.id,
              player_name: bookingFormData.playerFullName || 'Your child',
              session_type: booking.session_type,
              session_date: booking.session_date,
              time_slot: booking.time_slot,
            });

            stats.reminders_sent++;
          }
        } catch (err) {
          console.error(`Error sending reminder for ${firebaseUid}:`, err);
          stats.errors++;
        }
      }
    }

    // =========================================================================
    // PART 2: CREDIT EXPIRY ALERTS
    // =========================================================================

    // Find credits expiring in the next 7 days
    const sevenDaysFromNow = new Date();
    sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);
    const expiryThreshold = sevenDaysFromNow.toISOString();

    const { data: expiringPurchases, error: expiryError } = await supabase
      .from('credit_purchases')
      .select(`
        id,
        firebase_uid,
        credits_remaining,
        expires_at
      `)
      .eq('status', 'active')
      .gt('credits_remaining', 0)
      .lte('expires_at', expiryThreshold)
      .gt('expires_at', new Date().toISOString());

    if (expiryError) {
      console.error('Error fetching expiring credits:', expiryError);
    } else if (expiringPurchases && expiringPurchases.length > 0) {
      // Group by firebase_uid
      const expiringByParent = new Map<string, { credits: number; expiresAt: string }>();

      for (const purchase of expiringPurchases) {
        const existing = expiringByParent.get(purchase.firebase_uid);
        if (existing) {
          existing.credits += purchase.credits_remaining;
          // Use earliest expiry date
          if (purchase.expires_at < existing.expiresAt) {
            existing.expiresAt = purchase.expires_at;
          }
        } else {
          expiringByParent.set(purchase.firebase_uid, {
            credits: purchase.credits_remaining,
            expiresAt: purchase.expires_at,
          });
        }
      }

      // Send expiry alerts
      for (const [firebaseUid, expiring] of expiringByParent) {
        try {
          // Get parent info
          const { data: reg } = await supabase
            .from('registrations')
            .select('form_data, parent_email')
            .eq('firebase_uid', firebaseUid)
            .limit(1)
            .single();

          if (reg) {
            const formData = reg.form_data || {};

            // Get current total balance
            const { data: parentCredits } = await supabase
              .from('parent_credits')
              .select('total_credits')
              .eq('firebase_uid', firebaseUid)
              .single();

            const contact = createMinimalContact(
              firebaseUid,
              reg.parent_email || formData.parentEmail || '',
              formData.parentPhone || '',
              formData.parentFullName || '',
              formData.communicationLanguage || 'English'
            );

            await sendCreditsExpiring(
              contact,
              expiring.credits,
              expiring.expiresAt,
              parentCredits?.total_credits || 0
            );

            stats.expiry_alerts_sent++;
          }
        } catch (err) {
          console.error(`Error sending expiry alert for ${firebaseUid}:`, err);
          stats.errors++;
        }
      }
    }

    return res.status(200).json({
      message: 'CRON job completed',
      stats,
      tomorrow_date: tomorrowDate,
    });
  } catch (error: any) {
    console.error('CRON session reminders error:', error);
    return res.status(500).json({
      error: 'CRON job failed',
      stats,
    });
  }
}
