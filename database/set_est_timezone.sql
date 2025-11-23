-- ============================================================
-- Set Database Timezone to EST (America/New_York)
-- ============================================================
-- This ensures all CURRENT_DATE, CURRENT_TIMESTAMP, and NOW()
-- functions return values in Eastern Time (EST/EDT).

-- Set the database default timezone to America/New_York
-- This handles both EST and EDT automatically
ALTER DATABASE postgres SET timezone TO 'America/New_York';

-- Set timezone for current session
SET timezone = 'America/New_York';

-- Verify timezone setting
SHOW timezone;

-- ============================================================
-- Update Sunday Practice Functions to Use EST Explicitly
-- ============================================================
-- Even with database timezone set, explicitly ensure EST in functions

-- Update get_next_sunday_slot to use timezone-aware date calculation
CREATE OR REPLACE FUNCTION public.get_next_sunday_slot(
  p_registration_id UUID,
  p_firebase_uid TEXT
)
RETURNS JSON AS $$
DECLARE
  v_player_category TEXT;
  v_player_category_num INTEGER;
  v_program_type TEXT;
  v_payment_status TEXT;
  v_next_sunday DATE;
  v_existing_booking UUID;
  v_existing_booking_slot JSON;
  v_slots JSON;
BEGIN
  -- Get player info
  SELECT
    form_data->>'playerCategory',
    form_data->>'programType',
    payment_status
  INTO v_player_category, v_program_type, v_payment_status
  FROM public.registrations
  WHERE id = p_registration_id AND firebase_uid = p_firebase_uid;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Registration not found');
  END IF;

  -- Check eligibility
  IF v_program_type != 'group' THEN
    RETURN json_build_object('success', true, 'eligible', false, 'reason', 'Only Group Training players can book Sunday practice');
  END IF;

  v_player_category_num := extract_category_number(v_player_category);

  IF v_player_category_num < 11 OR v_player_category_num > 15 THEN
    RETURN json_build_object('success', true, 'eligible', false, 'reason', 'Only M11-M15 players can book Sunday practice');
  END IF;

  IF v_payment_status NOT IN ('succeeded', 'verified', 'paid') THEN
    RETURN json_build_object('success', true, 'eligible', false, 'reason', 'Active subscription required');
  END IF;

  -- Calculate next Sunday in EST
  -- CURRENT_DATE now uses America/New_York timezone
  v_next_sunday := CURRENT_DATE + ((7 - EXTRACT(DOW FROM CURRENT_DATE)::INTEGER) % 7);

  -- If today is Sunday, return today
  IF v_next_sunday = CURRENT_DATE THEN
    v_next_sunday := CURRENT_DATE;
  END IF;

  -- Check for existing booking
  SELECT
    b.id,
    json_build_object(
      'booking_id', b.id,
      'slot_date', s.practice_date,
      'start_time', TO_CHAR(s.start_time, 'HH12:MI AM'),
      'end_time', TO_CHAR(s.end_time, 'HH12:MI AM')
    )
  INTO v_existing_booking, v_existing_booking_slot
  FROM public.sunday_bookings b
  INNER JOIN public.sunday_practice_slots s ON b.slot_id = s.id
  WHERE b.registration_id = p_registration_id
    AND s.practice_date = v_next_sunday
    AND b.booking_status = 'confirmed';

  IF FOUND THEN
    RETURN json_build_object(
      'success', true,
      'eligible', true,
      'already_booked', true,
      'existing_booking', v_existing_booking_slot,
      'next_sunday', v_next_sunday
    );
  END IF;

  -- Get available slots
  SELECT json_agg(
    json_build_object(
      'slot_id', id,
      'slot_date', practice_date,
      'start_time', TO_CHAR(start_time, 'HH12:MI AM'),
      'end_time', TO_CHAR(end_time, 'HH12:MI AM'),
      'time_range', CONCAT(TO_CHAR(start_time, 'HH12:MI AM'), ' - ', TO_CHAR(end_time, 'HH12:MI AM')),
      'min_category', min_category,
      'max_category', max_category,
      'capacity', max_capacity,
      'current_bookings', current_bookings,
      'available_spots', available_spots
    )
    ORDER BY start_time
  )
  INTO v_slots
  FROM public.sunday_practice_slots
  WHERE practice_date = v_next_sunday
    AND is_active = true
    AND available_spots > 0
    AND v_player_category_num >= extract_category_number(min_category)
    AND v_player_category_num <= extract_category_number(max_category);

  RETURN json_build_object(
    'success', true,
    'eligible', true,
    'already_booked', false,
    'next_sunday', v_next_sunday,
    'available_slots', COALESCE(v_slots, '[]'::json)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.get_next_sunday_slot TO anon, authenticated;

COMMENT ON FUNCTION public.get_next_sunday_slot IS 'Get next Sunday practice slot for a player (uses EST timezone)';

-- ============================================================
-- VERIFICATION
-- ============================================================
-- Run these queries to verify EST timezone is set correctly

-- Check database timezone
SELECT current_setting('TIMEZONE') as database_timezone;

-- Check current date and time in EST
SELECT
  CURRENT_DATE as current_date_est,
  CURRENT_TIMESTAMP as current_timestamp_est,
  NOW() as now_est,
  EXTRACT(DOW FROM CURRENT_DATE) as day_of_week_0_sunday;

-- Test next Sunday calculation
SELECT
  CURRENT_DATE as today,
  CURRENT_DATE + ((7 - EXTRACT(DOW FROM CURRENT_DATE)::INTEGER) % 7) as next_sunday_formula,
  CASE
    WHEN EXTRACT(DOW FROM CURRENT_DATE) = 0 THEN CURRENT_DATE
    ELSE CURRENT_DATE + ((7 - EXTRACT(DOW FROM CURRENT_DATE)::INTEGER) % 7)
  END as next_sunday_actual;

-- ============================================================
-- NOTES FOR VERCEL CRON JOBS
-- ============================================================
/*
IMPORTANT: Vercel cron jobs run in UTC by default.

Current cron configuration: "0 0 * * 1" (Monday midnight UTC)
This translates to: Sunday 8:00 PM EST (or 7:00 PM EDT)

To run at Monday midnight EST, use:
- "0 5 * * 1" (Monday 5:00 AM UTC = Monday 12:00 AM EST)
- Or "0 4 * * 1" during EDT (Monday 4:00 AM UTC = Monday 12:00 AM EDT)

Recommendation:
Update vercel.json cron schedule to:
{
  "crons": [{
    "path": "/api/cron-generate-sunday-slots",
    "schedule": "0 5 * * 1"
  }]
}

This ensures slots are generated Monday midnight EST, not Sunday evening.
*/
