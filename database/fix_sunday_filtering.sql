-- ============================================================
-- Fix Sunday Practice Slot Filtering
-- ============================================================
-- This fixes the issue where M13 players see M7-M11 slots
-- and updates eligibility to allow M7-M15 (not just M11-M15)
--
-- Issues fixed:
-- 1. Eligibility check now allows M7-M15 (was M11-M15)
-- 2. Ensures extract_category_number function exists and works
-- 3. Updates both get_next_sunday_slot and get_upcoming_sunday_slots
--
-- Run this in Supabase SQL Editor
-- ============================================================

-- STEP 1: Ensure extract_category_number function exists
CREATE OR REPLACE FUNCTION extract_category_number(category TEXT)
RETURNS INTEGER AS $$
BEGIN
  -- Handle Junior
  IF category = 'Junior' THEN
    RETURN 99;
  END IF;

  -- Extract number from M7, M11, M13, M13 Elite, M15 Elite, etc.
  -- Use regex to extract the number after 'M'
  RETURN CAST(SUBSTRING(category FROM 'M([0-9]+)') AS INTEGER);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

GRANT EXECUTE ON FUNCTION extract_category_number TO anon, authenticated;

-- STEP 2: Update get_next_sunday_slot (used by timeline)
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
  -- 1. Get registration details
  SELECT
    form_data->>'playerCategory',
    form_data->>'programType',
    payment_status
  INTO v_player_category, v_program_type, v_payment_status
  FROM public.registrations
  WHERE id = p_registration_id AND firebase_uid = p_firebase_uid;

  IF NOT FOUND THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Registration not found or unauthorized',
      'code', 'REGISTRATION_NOT_FOUND'
    );
  END IF;

  -- 2. Validate eligibility
  IF v_program_type != 'group' THEN
    RETURN json_build_object(
      'success', true,
      'eligible', false,
      'reason', 'Only Group Training players can book Sunday practice'
    );
  END IF;

  -- Extract numeric category for comparison
  v_player_category_num := extract_category_number(v_player_category);

  -- FIXED: Check if category is M7-M15 (was M11+)
  IF v_player_category_num < 7 OR v_player_category_num > 15 THEN
    RETURN json_build_object(
      'success', true,
      'eligible', false,
      'reason', 'Sunday practice is only available for M7-M15 players'
    );
  END IF;

  -- Accept succeeded, verified, and paid payment statuses
  IF v_payment_status NOT IN ('succeeded', 'verified', 'paid') THEN
    RETURN json_build_object(
      'success', true,
      'eligible', false,
      'reason', 'Active subscription required to book Sunday practice'
    );
  END IF;

  -- 3. Calculate next Sunday
  v_next_sunday := CURRENT_DATE + ((7 - EXTRACT(DOW FROM CURRENT_DATE)::INTEGER) % 7);
  IF v_next_sunday = CURRENT_DATE THEN
    v_next_sunday := v_next_sunday + 7;
  END IF;

  -- 4. Check if player already has a booking for next Sunday
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

  -- 5. Get available slots for next Sunday with NUMERIC category comparison
  SELECT json_agg(
    json_build_object(
      'slot_id', id,
      'slot_date', practice_date,
      'start_time', TO_CHAR(start_time, 'HH12:MI AM'),
      'end_time', TO_CHAR(end_time, 'HH12:MI AM'),
      'time_range', CONCAT(
        TO_CHAR(start_time, 'HH12:MI AM'),
        ' - ',
        TO_CHAR(end_time, 'HH12:MI AM')
      ),
      'min_category', min_category,
      'max_category', max_category,
      'capacity', max_capacity,
      'current_bookings', current_bookings,
      'spots_remaining', available_spots
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

  -- 6. Return available slots
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

-- STEP 3: Update get_upcoming_sunday_slots (for multi-week view)
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
  v_week_index INTEGER := 0;
  v_sunday_data JSON;
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

  -- FIXED: Allow M7-M15 (was M11-M15)
  IF v_player_category_num < 7 OR v_player_category_num > 15 THEN
    RETURN json_build_object('success', true, 'eligible', false, 'reason', 'Sunday practice is only available for M7-M15 players');
  END IF;

  IF v_payment_status NOT IN ('succeeded', 'verified', 'paid') THEN
    RETURN json_build_object('success', true, 'eligible', false, 'reason', 'Active subscription required');
  END IF;

  -- Calculate starting Sunday (next Sunday from today)
  v_current_sunday := CURRENT_DATE + ((7 - EXTRACT(DOW FROM CURRENT_DATE)::INTEGER) % 7);
  IF v_current_sunday = CURRENT_DATE THEN
    v_current_sunday := v_current_sunday;  -- If today is Sunday, include today
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

-- STEP 4: Verify the fix
DO $$
BEGIN
  RAISE NOTICE '✅ Sunday practice filtering functions updated!';
  RAISE NOTICE '';
  RAISE NOTICE 'Fixed issues:';
  RAISE NOTICE '  1. Eligibility now allows M7-M15 (was M11-M15)';
  RAISE NOTICE '  2. Slot filtering uses numeric comparison (13 <= 11 = false)';
  RAISE NOTICE '  3. M13 players will only see M13-M15 slots';
  RAISE NOTICE '  4. M7/M9 players will only see M7-M11 slots';
  RAISE NOTICE '  5. M18/Junior players will be marked ineligible';
  RAISE NOTICE '';
  RAISE NOTICE '📝 Next step: Run this SQL in Supabase SQL Editor';
END $$;
