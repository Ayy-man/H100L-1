import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import type {
  RecurringScheduleRequest,
  RecurringScheduleResponse,
  RecurringSchedule,
} from '../types/credits';
import { isDayOfWeek, isSessionType } from '../types/credits';

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

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
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
      return res.status(500).json({ error: 'Database error' });
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
    return res.status(500).json({ error: 'Failed to fetch recurring schedules' });
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
        error: 'Invalid session_type',
      });
    }

    // Validate day of week
    if (!isDayOfWeek(day_of_week)) {
      return res.status(400).json({
        error: 'Invalid day_of_week',
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

    // Create recurring schedule (upsert to handle existing)
    const { data: schedule, error: createError } = await supabase
      .from('recurring_schedules')
      .upsert({
        firebase_uid,
        registration_id,
        session_type,
        day_of_week,
        time_slot,
        is_active: true,
        paused_reason: null,
        next_booking_date: nextBookingDate,
      }, {
        onConflict: 'registration_id,day_of_week,time_slot',
      })
      .select()
      .single();

    if (createError) {
      console.error('Error creating recurring schedule:', createError);
      return res.status(500).json({ error: 'Failed to create recurring schedule' });
    }

    const response: RecurringScheduleResponse = {
      schedule: schedule as RecurringSchedule,
      message: `Recurring ${day_of_week} ${time_slot} schedule created. Auto-booking will start from ${nextBookingDate}.`,
    };

    return res.status(201).json(response);
  } catch (error: any) {
    console.error('Create recurring schedule error:', error);
    return res.status(500).json({ error: 'Failed to create recurring schedule' });
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
    return res.status(500).json({ error: 'Failed to update recurring schedule' });
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
    return res.status(500).json({ error: 'Failed to delete recurring schedule' });
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
