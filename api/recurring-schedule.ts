import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

// Inline types (Vercel bundling doesn't resolve ../types/credits)
type SessionType = 'group' | 'sunday' | 'private' | 'semi_private';
type DayOfWeek = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';

const SESSION_TYPES = ['group', 'sunday', 'private', 'semi_private'] as const;
const DAYS_OF_WEEK = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const;

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

    return res.status(201).json({
      schedule,
      message: `Recurring ${day_of_week} ${time_slot} schedule created. Auto-booking will start from ${nextBookingDate}.`,
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
