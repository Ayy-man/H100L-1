-- ============================================================
-- Update Sunday Practice Functions for Multi-Week Booking
-- ============================================================
-- Allows players to see and book the next 2 upcoming Sundays
-- Adds capacity indicators for both admin and player views

-- ============================================================
-- STEP 1: Create function to get next N Sundays with slots
-- ============================================================
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

COMMENT ON FUNCTION public.get_upcoming_sunday_slots IS 'Returns available Sunday practice slots for the next N weeks (default 2) for a player';

-- ============================================================
-- STEP 2: Keep original function for backward compatibility
-- ============================================================
-- The get_next_sunday_slot function remains unchanged for existing code
