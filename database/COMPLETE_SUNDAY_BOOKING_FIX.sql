-- ============================================
-- COMPLETE SUNDAY BOOKING SYSTEM FIX
-- ============================================
-- This file fixes all Sunday booking functions to work with the current schema
-- Run this entire file in Supabase SQL Editor
-- ============================================

-- PART 1: Ensure enum type exists
DO $$ BEGIN
  CREATE TYPE attendance_status_enum AS ENUM ('pending', 'attended', 'absent', 'excused');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- PART 2: Ensure columns exist (safe to run multiple times)
DO $$
BEGIN
  -- Add attendance_status column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'sunday_bookings'
    AND column_name = 'attendance_status'
  ) THEN
    ALTER TABLE public.sunday_bookings
      ADD COLUMN attendance_status attendance_status_enum DEFAULT 'pending'::attendance_status_enum;
  END IF;

  -- Add attendance_notes column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'sunday_bookings'
    AND column_name = 'attendance_notes'
  ) THEN
    ALTER TABLE public.sunday_bookings
      ADD COLUMN attendance_notes TEXT DEFAULT NULL;
  END IF;
END $$;

-- PART 3: Create/Replace mark_attendance function
CREATE OR REPLACE FUNCTION public.mark_attendance(
  p_booking_id UUID,
  p_attendance_status TEXT,
  p_admin_email TEXT,
  p_notes TEXT DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
  v_booking_status TEXT;
  v_slot_date DATE;
BEGIN
  -- Validate attendance status
  IF p_attendance_status NOT IN ('attended', 'absent', 'excused') THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Invalid attendance status. Must be: attended, absent, or excused',
      'code', 'INVALID_STATUS'
    );
  END IF;

  -- Get booking details
  SELECT b.booking_status, s.practice_date
  INTO v_booking_status, v_slot_date
  FROM public.sunday_bookings b
  INNER JOIN public.sunday_practice_slots s ON b.slot_id = s.id
  WHERE b.id = p_booking_id;

  IF NOT FOUND THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Booking not found',
      'code', 'BOOKING_NOT_FOUND'
    );
  END IF;

  -- Check if booking is cancelled
  IF v_booking_status = 'cancelled' THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Cannot mark attendance for cancelled booking',
      'code', 'BOOKING_CANCELLED'
    );
  END IF;

  -- Update attendance
  UPDATE public.sunday_bookings
  SET
    attendance_status = p_attendance_status::attendance_status_enum,
    attendance_notes = p_notes,
    attendance_marked_at = NOW(),
    attendance_marked_by = p_admin_email,
    attended = CASE WHEN p_attendance_status = 'attended' THEN true ELSE false END,
    updated_at = NOW()
  WHERE id = p_booking_id;

  -- Return success
  RETURN json_build_object(
    'success', true,
    'booking_id', p_booking_id,
    'attendance_status', p_attendance_status,
    'marked_at', NOW(),
    'marked_by', p_admin_email,
    'message', 'Attendance marked successfully'
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'success', false,
      'error', SQLERRM,
      'code', 'DATABASE_ERROR'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- PART 4: Create/Replace get_sunday_roster function
CREATE OR REPLACE FUNCTION public.get_sunday_roster(
  p_practice_date DATE
)
RETURNS JSON AS $$
DECLARE
  v_roster JSON;
  v_stats JSON;
BEGIN
  -- Build roster data with slots and bookings
  SELECT json_build_object(
    'practice_date', p_practice_date,
    'slots', COALESCE(json_agg(slot_data ORDER BY slot_data->>'start_time'), '[]'::json)
  )
  INTO v_roster
  FROM (
    SELECT json_build_object(
      'slot_id', s.id,
      'start_time', s.start_time,
      'end_time', s.end_time,
      'time_range', CONCAT(
        TO_CHAR(s.start_time, 'HH12:MI AM'),
        ' - ',
        TO_CHAR(s.end_time, 'HH12:MI AM')
      ),
      'min_category', s.min_category,
      'max_category', s.max_category,
      'max_capacity', s.max_capacity,
      'current_bookings', s.current_bookings,
      'available_spots', s.available_spots,
      'bookings', COALESCE(
        (
          SELECT json_agg(
            json_build_object(
              'booking_id', b.id,
              'player_name', b.player_name,
              'player_category', b.player_category,
              'parent_name', b.parent_name,
              'parent_email', b.parent_email,
              'booking_status', b.booking_status,
              'booked_at', b.booked_at,
              'cancelled_at', b.cancelled_at,
              'attendance_status', COALESCE(b.attendance_status::text, 'pending'),
              'attendance_marked_at', b.attendance_marked_at,
              'attendance_marked_by', b.attendance_marked_by,
              'attendance_notes', b.attendance_notes,
              'registration_id', b.registration_id
            )
            ORDER BY b.booked_at
          )
          FROM public.sunday_bookings b
          WHERE b.slot_id = s.id AND b.booking_status != 'cancelled'
        ),
        '[]'::json
      )
    ) as slot_data
    FROM public.sunday_practice_slots s
    WHERE s.practice_date = p_practice_date
      AND s.is_active = true
  ) slots;

  -- Calculate statistics
  SELECT json_build_object(
    'total_bookings', COALESCE(COUNT(*), 0),
    'attended_count', COALESCE(COUNT(*) FILTER (WHERE attendance_status::text = 'attended'), 0),
    'absent_count', COALESCE(COUNT(*) FILTER (WHERE attendance_status::text = 'absent'), 0),
    'excused_count', COALESCE(COUNT(*) FILTER (WHERE attendance_status::text = 'excused'), 0),
    'pending_count', COALESCE(COUNT(*) FILTER (WHERE attendance_status::text = 'pending' OR attendance_status IS NULL), 0),
    'attendance_rate', CASE
      WHEN COUNT(*) FILTER (WHERE attendance_status::text != 'pending' AND attendance_status IS NOT NULL) > 0
      THEN ROUND(
        (COUNT(*) FILTER (WHERE attendance_status::text = 'attended')::NUMERIC /
         COUNT(*) FILTER (WHERE attendance_status::text != 'pending' AND attendance_status IS NOT NULL)::NUMERIC) * 100,
        1
      )
      ELSE 0
    END
  )
  INTO v_stats
  FROM public.sunday_bookings b
  INNER JOIN public.sunday_practice_slots s ON b.slot_id = s.id
  WHERE s.practice_date = p_practice_date
    AND b.booking_status != 'cancelled';

  -- Return combined result
  RETURN json_build_object(
    'success', true,
    'roster', v_roster,
    'stats', COALESCE(v_stats, json_build_object(
      'total_bookings', 0,
      'attended_count', 0,
      'absent_count', 0,
      'excused_count', 0,
      'pending_count', 0,
      'attendance_rate', 0
    ))
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'success', false,
      'error', SQLERRM,
      'code', 'DATABASE_ERROR'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- PART 5: Grant permissions
GRANT EXECUTE ON FUNCTION public.mark_attendance TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_sunday_roster TO authenticated;

-- PART 6: Update sunday_bookings_detail view
DROP VIEW IF EXISTS public.sunday_bookings_detail;

CREATE OR REPLACE VIEW public.sunday_bookings_detail AS
SELECT
  -- Booking info
  b.id AS booking_id,
  b.booking_status,
  b.booked_at,
  b.cancelled_at,
  COALESCE(b.attendance_status::text, 'pending') as attendance_status,
  b.attendance_marked_at,
  b.attendance_marked_by,
  b.attendance_notes,
  b.attended,

  -- Slot info
  s.id AS slot_id,
  s.practice_date,
  s.start_time,
  s.end_time,
  s.min_category,
  s.max_category,
  s.max_capacity,
  s.current_bookings,
  s.available_spots,
  s.is_active,

  -- Player info
  b.player_name,
  b.player_category,
  b.parent_email,
  b.parent_name,

  -- Registration info
  b.registration_id,
  r.firebase_uid,
  r.payment_status,

  -- Derived fields
  CONCAT(
    TO_CHAR(s.start_time, 'HH12:MI AM'),
    ' - ',
    TO_CHAR(s.end_time, 'HH12:MI AM')
  ) AS time_range,

  CASE
    WHEN b.attendance_status::text = 'attended' THEN 'Attended'
    WHEN b.attendance_status::text = 'absent' THEN 'Absent'
    WHEN b.attendance_status::text = 'excused' THEN 'Excused'
    WHEN b.booking_status = 'cancelled' THEN 'Cancelled'
    WHEN s.practice_date < CURRENT_DATE THEN 'Past'
    WHEN s.practice_date = CURRENT_DATE THEN 'Today'
    ELSE 'Upcoming'
  END AS booking_display_status

FROM public.sunday_bookings b
INNER JOIN public.sunday_practice_slots s ON b.slot_id = s.id
INNER JOIN public.registrations r ON b.registration_id = r.id
ORDER BY s.practice_date DESC, s.start_time ASC;

GRANT SELECT ON public.sunday_bookings_detail TO authenticated;

-- PART 7: Update get_upcoming_sunday_slots for M7-M15 eligibility
CREATE OR REPLACE FUNCTION public.get_upcoming_sunday_slots(
  p_registration_id UUID,
  p_firebase_uid TEXT,
  p_num_weeks INTEGER DEFAULT 2
)
RETURNS JSON AS $$
DECLARE
  v_player_category TEXT;
  v_player_category_num INTEGER;
  v_program_type TEXT;
  v_payment_status TEXT;
  v_sundays JSON;
  v_current_sunday DATE;
  v_current_time TIME;
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

  -- FIXED: Changed from M11-M15 to M7-M15
  IF v_player_category_num < 7 OR v_player_category_num > 15 THEN
    RETURN json_build_object('success', true, 'eligible', false, 'reason', 'Only M7-M15 players can book Sunday practice');
  END IF;

  IF v_payment_status NOT IN ('succeeded', 'verified', 'paid', 'active') THEN
    RETURN json_build_object('success', true, 'eligible', false, 'reason', 'Active subscription required');
  END IF;

  -- Get current time for filtering
  v_current_time := CURRENT_TIME;

  -- Calculate starting Sunday
  IF EXTRACT(DOW FROM CURRENT_DATE) = 0 THEN
    -- Today is Sunday - check if slots have ended
    IF v_current_time >= '09:30:00'::TIME THEN
      v_current_sunday := CURRENT_DATE + 7;
    ELSE
      v_current_sunday := CURRENT_DATE;
    END IF;
  ELSE
    -- Not Sunday - calculate next Sunday
    v_current_sunday := CURRENT_DATE + ((7 - EXTRACT(DOW FROM CURRENT_DATE)::INTEGER) % 7);
    IF v_current_sunday = CURRENT_DATE THEN
      v_current_sunday := v_current_sunday + 7;
    END IF;
  END IF;

  -- Get data for next N Sundays
  WITH sunday_weeks AS (
    SELECT
      generate_series(
        v_current_sunday,
        v_current_sunday + ((p_num_weeks - 1) * 7),
        '7 days'::interval
      )::date AS sunday_date
  ),
  sunday_slots AS (
    SELECT
      sw.sunday_date,
      s.id AS slot_id,
      s.practice_date,
      s.start_time,
      s.end_time,
      CONCAT(TO_CHAR(s.start_time, 'HH12:MI AM'), ' - ', TO_CHAR(s.end_time, 'HH12:MI AM')) AS time_range,
      s.min_category,
      s.max_category,
      s.max_capacity,
      s.current_bookings,
      s.available_spots,
      -- Check if player already has a booking for this slot
      EXISTS(
        SELECT 1 FROM public.sunday_bookings b
        WHERE b.registration_id = p_registration_id
          AND b.slot_id = s.id
          AND b.booking_status = 'confirmed'
      ) AS player_booked,
      -- Get booking ID if exists
      (
        SELECT b.id FROM public.sunday_bookings b
        WHERE b.registration_id = p_registration_id
          AND b.slot_id = s.id
          AND b.booking_status = 'confirmed'
        LIMIT 1
      ) AS booking_id
    FROM sunday_weeks sw
    LEFT JOIN public.sunday_practice_slots s ON s.practice_date = sw.sunday_date
    WHERE s.is_active = true
      -- Don't show slots that have already ended
      AND NOT (
        s.practice_date = CURRENT_DATE
        AND s.end_time <= CURRENT_TIME
      )
      AND v_player_category_num >= extract_category_number(s.min_category)
      AND v_player_category_num <= extract_category_number(s.max_category)
    ORDER BY sw.sunday_date, s.start_time
  )
  SELECT json_agg(
    json_build_object(
      'date', sunday_date,
      'slots', (
        SELECT json_agg(
          json_build_object(
            'slot_id', slot_id,
            'date', practice_date,
            'start_time', TO_CHAR(start_time, 'HH12:MI AM'),
            'end_time', TO_CHAR(end_time, 'HH12:MI AM'),
            'time_range', time_range,
            'min_category', min_category,
            'max_category', max_category,
            'max_capacity', max_capacity,
            'current_bookings', current_bookings,
            'available_spots', available_spots,
            'player_booked', player_booked,
            'booking_id', booking_id
          )
        )
        FROM sunday_slots ss
        WHERE ss.sunday_date = sunday_weeks.sunday_date
      )
    )
  )
  INTO v_sundays
  FROM (SELECT DISTINCT sunday_date FROM sunday_slots) AS sunday_weeks;

  RETURN json_build_object(
    'success', true,
    'eligible', true,
    'weeks', COALESCE(v_sundays, '[]'::json)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.get_upcoming_sunday_slots TO anon, authenticated;

-- PART 8: Verification
SELECT 'VERIFICATION RESULTS:' as status;

-- Check columns exist
SELECT
  'Columns Check' as test,
  CASE
    WHEN COUNT(*) = 2 THEN '✅ PASS - Both columns exist'
    ELSE '❌ FAIL - Missing columns'
  END as result
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'sunday_bookings'
  AND column_name IN ('attendance_status', 'attendance_notes');

-- Check functions exist
SELECT
  'Functions Check' as test,
  CASE
    WHEN COUNT(*) >= 2 THEN '✅ PASS - Functions exist'
    ELSE '❌ FAIL - Missing functions'
  END as result
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN ('mark_attendance', 'get_sunday_roster');

-- Check view exists
SELECT
  'View Check' as test,
  CASE
    WHEN COUNT(*) = 1 THEN '✅ PASS - View exists'
    ELSE '❌ FAIL - View missing'
  END as result
FROM information_schema.views
WHERE table_schema = 'public'
  AND table_name = 'sunday_bookings_detail';

SELECT 'Migration completed successfully!' as status;
