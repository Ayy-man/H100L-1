-- ============================================================
-- Fix: Hide booking confirmation after practice ends (9:30 AM)
-- ============================================================
-- Currently bookings show until midnight. Should hide after end_time.

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

  -- Allow M7-M15 players
  IF v_player_category_num < 7 OR v_player_category_num > 15 THEN
    RETURN json_build_object('success', true, 'eligible', false, 'reason', 'Only M7-M15 players can book Sunday practice');
  END IF;

  IF v_payment_status NOT IN ('succeeded', 'verified', 'paid') THEN
    RETURN json_build_object('success', true, 'eligible', false, 'reason', 'Active subscription required');
  END IF;

  -- Get current date and time in EST
  v_current_sunday := CURRENT_DATE;
  v_current_time := CURRENT_TIME;

  -- Calculate starting Sunday (next Sunday from today, or today if Sunday and slots haven't ended)
  IF EXTRACT(DOW FROM CURRENT_DATE) = 0 THEN
    -- Today is Sunday - check if any slots are still in the future
    -- If the last slot has ended (9:30 AM), move to next Sunday
    IF v_current_time >= '09:30:00'::TIME THEN
      v_current_sunday := CURRENT_DATE + 7;
    ELSE
      v_current_sunday := CURRENT_DATE;
    END IF;
  ELSE
    -- Not Sunday - calculate next Sunday
    v_current_sunday := CURRENT_DATE + ((7 - EXTRACT(DOW FROM CURRENT_DATE)::INTEGER) % 7);
  END IF;

  -- Get data for next N Sundays, excluding past slots
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
      -- CRITICAL FIX: Exclude slots that have already ended
      AND NOT (
        s.practice_date = CURRENT_DATE
        AND s.end_time <= CURRENT_TIME
      )
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

COMMENT ON FUNCTION public.get_upcoming_sunday_slots IS 'Returns upcoming Sunday slots for next N weeks, excluding slots that have already ended (checks both date and time)';

-- ============================================================
-- Update get_next_sunday_slot for backward compatibility
-- ============================================================
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
  v_current_time TIME;
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

  -- Allow M7-M15 players
  IF v_player_category_num < 7 OR v_player_category_num > 15 THEN
    RETURN json_build_object('success', true, 'eligible', false, 'reason', 'Only M7-M15 players can book Sunday practice');
  END IF;

  IF v_payment_status NOT IN ('succeeded', 'verified', 'paid') THEN
    RETURN json_build_object('success', true, 'eligible', false, 'reason', 'Active subscription required');
  END IF;

  -- Get current time
  v_current_time := CURRENT_TIME;

  -- Calculate next Sunday
  IF EXTRACT(DOW FROM CURRENT_DATE) = 0 THEN
    -- Today is Sunday - check if slots have ended
    IF v_current_time >= '09:30:00'::TIME THEN
      v_next_sunday := CURRENT_DATE + 7;
    ELSE
      v_next_sunday := CURRENT_DATE;
    END IF;
  ELSE
    v_next_sunday := CURRENT_DATE + ((7 - EXTRACT(DOW FROM CURRENT_DATE)::INTEGER) % 7);
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
    AND b.booking_status = 'confirmed'
    -- Don't show booking if slot has already ended
    AND NOT (
      s.practice_date = CURRENT_DATE
      AND s.end_time <= CURRENT_TIME
    );

  IF FOUND THEN
    RETURN json_build_object(
      'success', true,
      'eligible', true,
      'already_booked', true,
      'existing_booking', v_existing_booking_slot,
      'next_sunday', v_next_sunday
    );
  END IF;

  -- Get available slots (exclude slots that have ended)
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
    AND v_player_category_num <= extract_category_number(max_category)
    -- Don't show slots that have already ended
    AND NOT (
      practice_date = CURRENT_DATE
      AND end_time <= CURRENT_TIME
    );

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

COMMENT ON FUNCTION public.get_next_sunday_slot IS 'Get next Sunday practice slot for a player (excludes slots that have ended based on time)';
