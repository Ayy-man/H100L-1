import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { MAX_GROUP_CAPACITY } from '../types/credits';

// Lazy-initialized Supabase client
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
 * CRON JOB: Process Recurring Schedules
 *
 * This endpoint is called by Vercel CRON or external scheduler to:
 * 1. Find all active recurring schedules due for booking
 * 2. Check parent has sufficient credits
 * 3. Check slot availability
 * 4. Create bookings and deduct credits
 * 5. Update next_booking_date or pause if insufficient credits
 *
 * Recommended schedule: Daily at 6 AM EST
 */
export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // Only allow POST (or GET for testing)
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
    processed: 0,
    booked: 0,
    paused_insufficient_credits: 0,
    paused_slot_unavailable: 0,
    errors: 0,
  };

  try {
    const today = new Date().toISOString().split('T')[0];

    // Get all active recurring schedules due for booking
    const { data: schedules, error: fetchError } = await supabase
      .from('recurring_schedules')
      .select('*')
      .eq('is_active', true)
      .lte('next_booking_date', today);

    if (fetchError) {
      console.error('Error fetching recurring schedules:', fetchError);
      return res.status(500).json({ error: 'Database error' });
    }

    if (!schedules || schedules.length === 0) {
      return res.status(200).json({
        message: 'No recurring schedules due for processing',
        stats,
      });
    }

    // Process each schedule
    for (const schedule of schedules) {
      stats.processed++;

      try {
        // Check parent credit balance
        const { data: parentCredits } = await supabase
          .from('parent_credits')
          .select('total_credits')
          .eq('firebase_uid', schedule.firebase_uid)
          .single();

        const creditsAvailable = parentCredits?.total_credits || 0;

        if (creditsAvailable < 1) {
          // Pause schedule due to insufficient credits
          await supabase
            .from('recurring_schedules')
            .update({
              is_active: false,
              paused_reason: 'insufficient_credits',
            })
            .eq('id', schedule.id);

          stats.paused_insufficient_credits++;
          continue;
        }

        // Check slot availability for the booking date
        const { data: slotCapacity } = await supabase
          .rpc('get_slot_capacity', {
            p_session_date: schedule.next_booking_date,
            p_time_slot: schedule.time_slot,
            p_session_type: 'group',
            p_max_capacity: MAX_GROUP_CAPACITY,
          });

        if (!slotCapacity || slotCapacity.length === 0 || !slotCapacity[0].is_available) {
          // Pause schedule due to slot unavailable
          await supabase
            .from('recurring_schedules')
            .update({
              is_active: false,
              paused_reason: 'slot_unavailable',
            })
            .eq('id', schedule.id);

          stats.paused_slot_unavailable++;
          continue;
        }

        // Check for existing booking to prevent duplicates
        const { data: existingBooking } = await supabase
          .from('session_bookings')
          .select('id')
          .eq('registration_id', schedule.registration_id)
          .eq('session_date', schedule.next_booking_date)
          .eq('time_slot', schedule.time_slot)
          .eq('session_type', 'group')
          .neq('status', 'cancelled')
          .single();

        if (existingBooking) {
          // Booking already exists, just advance to next week
          const nextDate = getNextWeek(schedule.next_booking_date);
          await supabase
            .from('recurring_schedules')
            .update({
              last_booked_date: schedule.next_booking_date,
              next_booking_date: nextDate,
            })
            .eq('id', schedule.id);

          continue;
        }

        // Deduct credit
        const { data: purchaseId, error: deductError } = await supabase
          .rpc('deduct_credit', {
            p_firebase_uid: schedule.firebase_uid,
            p_credits_to_deduct: 1,
          });

        if (deductError) {
          console.error(`Failed to deduct credit for schedule ${schedule.id}:`, deductError);
          stats.errors++;
          continue;
        }

        // Create booking
        const { error: bookingError } = await supabase
          .from('session_bookings')
          .insert({
            firebase_uid: schedule.firebase_uid,
            registration_id: schedule.registration_id,
            session_type: 'group',
            session_date: schedule.next_booking_date,
            time_slot: schedule.time_slot,
            credits_used: 1,
            credit_purchase_id: purchaseId,
            is_recurring: true,
            recurring_schedule_id: schedule.id,
            status: 'booked',
          });

        if (bookingError) {
          console.error(`Failed to create booking for schedule ${schedule.id}:`, bookingError);
          // Refund the credit
          await supabase.rpc('refund_credit', {
            p_firebase_uid: schedule.firebase_uid,
            p_purchase_id: purchaseId,
            p_credits_to_refund: 1,
          });
          stats.errors++;
          continue;
        }

        // Update schedule with next booking date
        const nextDate = getNextWeek(schedule.next_booking_date);
        await supabase
          .from('recurring_schedules')
          .update({
            last_booked_date: schedule.next_booking_date,
            next_booking_date: nextDate,
          })
          .eq('id', schedule.id);

        stats.booked++;
      } catch (err) {
        console.error(`Error processing schedule ${schedule.id}:`, err);
        stats.errors++;
      }
    }

    return res.status(200).json({
      message: 'Recurring schedule processing complete',
      stats,
    });
  } catch (error: any) {
    console.error('CRON process recurring error:', error);
    return res.status(500).json({
      error: 'Failed to process recurring schedules',
      stats,
    });
  }
}

/**
 * Get date one week from given date
 */
function getNextWeek(dateString: string): string {
  const date = new Date(dateString);
  date.setDate(date.getDate() + 7);
  return date.toISOString().split('T')[0];
}
