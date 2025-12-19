import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

// Inline types (Vercel bundling doesn't resolve ../types/credits)
type SessionType = 'group' | 'sunday' | 'private' | 'semi_private';
type DayOfWeek = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';

const SESSION_TYPES = ['group', 'sunday', 'private', 'semi_private'] as const;
const DAYS_OF_WEEK = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const;
const MAX_GROUP_CAPACITY = 6;

function isSessionType(value: string): value is SessionType {
  return SESSION_TYPES.includes(value as SessionType);
}

function isDayOfWeek(value: string): value is DayOfWeek {
  return DAYS_OF_WEEK.includes(value as DayOfWeek);
}

interface RecurringScheduleRequest {
  firebase_uid: string;
  registration_id: string;
  session_type: SessionType;
  day_of_week: DayOfWeek;
  time_slot: string;
}

interface RecurringSchedule {
  id: string;
  firebase_uid: string;
  registration_id: string;
  session_type: SessionType;
  day_of_week: DayOfWeek;
  time_slot: string;
  is_active: boolean;
  paused_reason: string | null;
  last_booked_date: string | null;
  next_booking_date: string | null;
  created_at: string;
  updated_at: string;
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
    console.error('[recurring-schedule] Missing env vars:', {
      hasUrl: !!process.env.VITE_SUPABASE_URL,
      hasKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    });
    return res.status(500).json({ error: 'Server configuration error' });
  }

  try {
    const supabase = getSupabase();

    switch (req.method) {
      case 'GET':
        return handleGet(req, res, supabase);
      case 'POST':
        return handlePost(req, res, supabase);
      case 'PUT':
        return handlePut(req, res, supabase);
      case 'DELETE':
        return handleDelete(req, res, supabase);
      default:
        return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error: any) {
    console.error('Recurring schedule handler error:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}

// GET: Fetch recurring schedules for a user
async function handleGet(
  req: VercelRequest,
  res: VercelResponse,
  supabase: ReturnType<typeof createClient>
) {
  try {
    const firebase_uid = req.query.firebase_uid as string;

    if (!firebase_uid) {
      return res.status(400).json({
        error: 'Missing required query parameter: firebase_uid',
      });
    }

    const { data: schedules, error } = await supabase
      .from('recurring_schedules')
      .select(`
        *,
        registrations!inner (
          form_data
        )
      `)
      .eq('firebase_uid', firebase_uid)
      .order('day_of_week', { ascending: true });

    if (error) {
      console.error('Error fetching recurring schedules:', error);
      return res.status(500).json({ error: 'Database error fetching schedules' });
    }

    // Transform to include player info
    const schedulesWithDetails = (schedules || []).map((s: any) => ({
      ...s,
      player_name: s.registrations?.form_data?.playerFullName || 'Unknown',
      player_category: s.registrations?.form_data?.playerCategory || 'Unknown',
    }));

    return res.status(200).json({ schedules: schedulesWithDetails });
  } catch (error: any) {
    console.error('Get recurring schedules error:', error);
    return res.status(500).json({ error: error.message || 'Failed to fetch recurring schedules' });
  }
}

// POST: Create a new recurring schedule
async function handlePost(
  req: VercelRequest,
  res: VercelResponse,
  supabase: ReturnType<typeof createClient>
) {
  try {
    const {
      firebase_uid,
      registration_id,
      session_type,
      day_of_week,
      time_slot,
    } = req.body as RecurringScheduleRequest;

    // Validate required fields
    if (!firebase_uid || !registration_id || !session_type || !day_of_week || !time_slot) {
      return res.status(400).json({
        error: 'Missing required fields: firebase_uid, registration_id, session_type, day_of_week, time_slot',
      });
    }

    // Validate session type
    if (!isSessionType(session_type)) {
      return res.status(400).json({
        error: `Invalid session_type. Must be one of: ${SESSION_TYPES.join(', ')}`,
      });
    }

    // Validate day of week
    if (!isDayOfWeek(day_of_week)) {
      return res.status(400).json({
        error: `Invalid day_of_week. Must be one of: ${DAYS_OF_WEEK.join(', ')}`,
      });
    }

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

    // Calculate next booking date (next occurrence of the day)
    const nextBookingDate = getNextDayOfWeek(day_of_week);

    // Check for existing schedule
    const { data: existing } = await supabase
      .from('recurring_schedules')
      .select('id')
      .eq('registration_id', registration_id)
      .eq('day_of_week', day_of_week)
      .eq('time_slot', time_slot)
      .maybeSingle();

    let schedule: RecurringSchedule;
    let createError: any;

    if (existing) {
      // Update existing schedule
      const { data, error } = await supabase
        .from('recurring_schedules')
        .update({
          session_type,
          is_active: true,
          paused_reason: null,
          next_booking_date: nextBookingDate,
        })
        .eq('id', existing.id)
        .select()
        .single();

      schedule = data as RecurringSchedule;
      createError = error;
    } else {
      // Create new schedule
      const { data, error } = await supabase
        .from('recurring_schedules')
        .insert({
          firebase_uid,
          registration_id,
          session_type,
          day_of_week,
          time_slot,
          is_active: true,
          paused_reason: null,
          next_booking_date: nextBookingDate,
        })
        .select()
        .single();

      schedule = data as RecurringSchedule;
      createError = error;
    }

    if (createError) {
      console.error('Error creating/updating recurring schedule:', createError);
      return res.status(500).json({
        error: 'Failed to create recurring schedule',
        details: createError.message,
      });
    }

    // === IMMEDIATE FIRST BOOKING ===
    // Create the first booking right away if conditions are met
    let firstBookingResult: { success: boolean; message: string; booking_date?: string } = {
      success: false,
      message: 'No immediate booking created',
    };

    try {
      // Only create immediate booking for group sessions
      if (session_type === 'group') {
        // Check if next_booking_date is within 14 days
        const nextDate = new Date(nextBookingDate);
        const today = new Date();
        const daysDiff = Math.ceil((nextDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

        if (daysDiff <= 14 && daysDiff >= 0) {
          // Check parent credit balance
          const { data: parentCredits } = await supabase
            .from('parent_credits')
            .select('total_credits')
            .eq('firebase_uid', firebase_uid)
            .single();

          const creditsAvailable = parentCredits?.total_credits || 0;

          if (creditsAvailable >= 1) {
            // Check slot availability
            const { data: slotCapacity } = await supabase
              .rpc('get_slot_capacity', {
                p_session_date: nextBookingDate,
                p_time_slot: time_slot,
                p_session_type: 'group',
                p_max_capacity: MAX_GROUP_CAPACITY,
              });

            const hasCapacity = slotCapacity && slotCapacity.length > 0 && slotCapacity[0].is_available;

            if (hasCapacity) {
              // Check for existing booking to prevent duplicates
              const { data: existingBooking } = await supabase
                .from('session_bookings')
                .select('id')
                .eq('registration_id', registration_id)
                .eq('session_date', nextBookingDate)
                .eq('time_slot', time_slot)
                .eq('session_type', 'group')
                .neq('status', 'cancelled')
                .maybeSingle();

              if (!existingBooking) {
                // Deduct credit
                const { data: purchaseId, error: deductError } = await supabase
                  .rpc('deduct_credit', {
                    p_firebase_uid: firebase_uid,
                    p_credits_to_deduct: 1,
                  });

                if (!deductError && purchaseId) {
                  // Create booking
                  const { error: bookingError } = await supabase
                    .from('session_bookings')
                    .insert({
                      firebase_uid,
                      registration_id,
                      session_type: 'group',
                      session_date: nextBookingDate,
                      time_slot,
                      credits_used: 1,
                      credit_purchase_id: purchaseId,
                      is_recurring: true,
                      recurring_schedule_id: schedule.id,
                      status: 'booked',
                    });

                  if (!bookingError) {
                    // Update schedule with next booking date (1 week later)
                    const oneWeekLater = new Date(nextBookingDate);
                    oneWeekLater.setDate(oneWeekLater.getDate() + 7);
                    const nextWeekDate = oneWeekLater.toISOString().split('T')[0];

                    await supabase
                      .from('recurring_schedules')
                      .update({
                        last_booked_date: nextBookingDate,
                        next_booking_date: nextWeekDate,
                      })
                      .eq('id', schedule.id);

                    firstBookingResult = {
                      success: true,
                      message: `First session booked for ${nextBookingDate}`,
                      booking_date: nextBookingDate,
                    };
                  } else {
                    // Refund the credit if booking failed
                    await supabase.rpc('refund_credit', {
                      p_firebase_uid: firebase_uid,
                      p_purchase_id: purchaseId,
                      p_credits_to_refund: 1,
                    });
                    firstBookingResult.message = 'Booking creation failed, credit refunded';
                  }
                } else {
                  firstBookingResult.message = 'Credit deduction failed';
                }
              } else {
                firstBookingResult.message = 'Booking already exists for this date';
              }
            } else {
              firstBookingResult.message = 'No slot capacity available';
            }
          } else {
            firstBookingResult.message = 'Insufficient credits for immediate booking';
          }
        } else {
          firstBookingResult.message = `Next booking date (${nextBookingDate}) is more than 14 days away`;
        }
      }
    } catch (bookingErr) {
      console.warn('Immediate booking failed (non-fatal):', bookingErr);
      firstBookingResult.message = 'Immediate booking error';
    }
    // === END IMMEDIATE FIRST BOOKING ===

    // Get player name for notification
    const { data: regData } = await supabase
      .from('registrations')
      .select('form_data, parent_email')
      .eq('id', registration_id)
      .single();

    const playerName = regData?.form_data?.playerFullName || 'A player';
    const playerCategory = regData?.form_data?.playerCategory || '';

    // Notify admins about new recurring schedule
    try {
      await supabase.from('notifications').insert({
        user_id: 'admin',
        user_type: 'admin',
        type: 'system',
        title: 'New Recurring Schedule',
        message: `${playerName} (${playerCategory}) set up recurring ${session_type} on ${day_of_week}s at ${time_slot}`,
        priority: 'low',
        data: {
          schedule_id: schedule.id,
          registration_id,
          player_name: playerName,
          player_category: playerCategory,
          session_type,
          day_of_week,
          time_slot,
          parent_email: regData?.parent_email,
        },
        action_url: '/admin',
      });
    } catch (notifyErr) {
      console.warn('Failed to create admin notification:', notifyErr);
    }

    // Build response message based on whether immediate booking was created
    let message = `Recurring ${day_of_week} ${time_slot} schedule created.`;
    if (firstBookingResult.success) {
      message += ` First session booked for ${firstBookingResult.booking_date}. Next auto-booking scheduled for following week.`;
    } else {
      message += ` Auto-booking will start from ${nextBookingDate}. (${firstBookingResult.message})`;
    }

    return res.status(201).json({
      schedule,
      message,
      first_booking: firstBookingResult,
    });
  } catch (error: any) {
    console.error('Create recurring schedule error:', error);
    return res.status(500).json({ error: error.message || 'Failed to create recurring schedule' });
  }
}

// PUT: Update (pause/resume) a recurring schedule
async function handlePut(
  req: VercelRequest,
  res: VercelResponse,
  supabase: ReturnType<typeof createClient>
) {
  try {
    const { schedule_id, firebase_uid, is_active, paused_reason } = req.body;

    if (!schedule_id || !firebase_uid) {
      return res.status(400).json({
        error: 'Missing required fields: schedule_id, firebase_uid',
      });
    }

    // Verify schedule belongs to this user
    const { data: schedule, error: scheduleError } = await supabase
      .from('recurring_schedules')
      .select('*')
      .eq('id', schedule_id)
      .eq('firebase_uid', firebase_uid)
      .single();

    if (scheduleError || !schedule) {
      return res.status(404).json({
        error: 'Recurring schedule not found or does not belong to this user',
      });
    }

    // Calculate next booking date if resuming
    let nextBookingDate = schedule.next_booking_date;
    if (is_active === true && !schedule.is_active) {
      nextBookingDate = getNextDayOfWeek(schedule.day_of_week);
    }

    // Update schedule
    const { data: updated, error: updateError } = await supabase
      .from('recurring_schedules')
      .update({
        is_active: is_active ?? schedule.is_active,
        paused_reason: is_active ? null : (paused_reason || 'user_paused'),
        next_booking_date: nextBookingDate,
      })
      .eq('id', schedule_id)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating recurring schedule:', updateError);
      return res.status(500).json({ error: 'Failed to update recurring schedule' });
    }

    const message = is_active
      ? 'Recurring schedule resumed.'
      : 'Recurring schedule paused.';

    return res.status(200).json({
      schedule: updated,
      message,
    });
  } catch (error: any) {
    console.error('Update recurring schedule error:', error);
    return res.status(500).json({ error: error.message || 'Failed to update recurring schedule' });
  }
}

// DELETE: Remove a recurring schedule
async function handleDelete(
  req: VercelRequest,
  res: VercelResponse,
  supabase: ReturnType<typeof createClient>
) {
  try {
    const schedule_id = req.query.schedule_id as string;
    const firebase_uid = req.query.firebase_uid as string;

    if (!schedule_id || !firebase_uid) {
      return res.status(400).json({
        error: 'Missing required query parameters: schedule_id, firebase_uid',
      });
    }

    // Verify schedule belongs to this user
    const { data: schedule, error: scheduleError } = await supabase
      .from('recurring_schedules')
      .select('id')
      .eq('id', schedule_id)
      .eq('firebase_uid', firebase_uid)
      .single();

    if (scheduleError || !schedule) {
      return res.status(404).json({
        error: 'Recurring schedule not found or does not belong to this user',
      });
    }

    // Delete schedule
    const { error: deleteError } = await supabase
      .from('recurring_schedules')
      .delete()
      .eq('id', schedule_id);

    if (deleteError) {
      console.error('Error deleting recurring schedule:', deleteError);
      return res.status(500).json({ error: 'Failed to delete recurring schedule' });
    }

    return res.status(200).json({
      success: true,
      message: 'Recurring schedule deleted.',
    });
  } catch (error: any) {
    console.error('Delete recurring schedule error:', error);
    return res.status(500).json({ error: error.message || 'Failed to delete recurring schedule' });
  }
}

/**
 * Get the next occurrence of a day of week
 */
function getNextDayOfWeek(dayName: string): string {
  const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const targetDay = days.indexOf(dayName.toLowerCase());

  const today = new Date();
  const currentDay = today.getDay();

  let daysUntilTarget = targetDay - currentDay;
  if (daysUntilTarget <= 0) {
    daysUntilTarget += 7; // Move to next week
  }

  const nextDate = new Date(today);
  nextDate.setDate(today.getDate() + daysUntilTarget);

  return nextDate.toISOString().split('T')[0];
}
