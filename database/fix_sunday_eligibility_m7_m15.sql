-- ============================================================
-- Fix Sunday Practice Eligibility: Allow M7-M15 (not just M11-M15)
-- ============================================================
-- The slots support M7-M11 and M13-M15, so eligibility should be M7-M15

-- ============================================================
-- Fix get_upcoming_sunday_slots function
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

-- ============================================================
-- Fix get_next_sunday_slot function (for backward compatibility)
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

  -- FIXED: Changed from M11-M15 to M7-M15
  IF v_player_category_num < 7 OR v_player_category_num > 15 THEN
    RETURN json_build_object('success', true, 'eligible', false, 'reason', 'Only M7-M15 players can book Sunday practice');
  END IF;

  IF v_payment_status NOT IN ('succeeded', 'verified', 'paid') THEN
    RETURN json_build_object('success', true, 'eligible', false, 'reason', 'Active subscription required');
  END IF;

  -- Calculate next Sunday in EST
  v_next_sunday := CURRENT_DATE + ((7 - EXTRACT(DOW FROM CURRENT_DATE)::INTEGER) % 7);
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

-- ============================================================
-- Fix book_sunday_slot function
-- ============================================================
CREATE OR REPLACE FUNCTION public.book_sunday_slot(
  p_slot_id UUID,
  p_registration_id UUID,
  p_firebase_uid TEXT
)
RETURNS JSON AS $$
DECLARE
  v_slot_date DATE;
  v_slot_start_time TIME;
  v_slot_end_time TIME;
  v_available_spots INTEGER;
  v_player_name TEXT;
  v_player_category TEXT;
  v_player_category_num INTEGER;
  v_parent_email TEXT;
  v_parent_name TEXT;
  v_program_type TEXT;
  v_payment_status TEXT;
  v_existing_booking UUID;
  v_booking_id UUID;
  v_min_category TEXT;
  v_max_category TEXT;
BEGIN
  -- Get slot details
  SELECT
    practice_date,
    start_time,
    end_time,
    available_spots,
    min_category,
    max_category
  INTO v_slot_date, v_slot_start_time, v_slot_end_time, v_available_spots, v_min_category, v_max_category
  FROM public.sunday_practice_slots
  WHERE id = p_slot_id AND is_active = true;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Slot not found or inactive', 'code', 'SLOT_NOT_FOUND');
  END IF;

  -- Check if slot is full
  IF v_available_spots <= 0 THEN
    RETURN json_build_object('success', false, 'error', 'This time slot is fully booked', 'code', 'SLOT_FULL');
  END IF;

  -- Check if slot is in the past
  IF v_slot_date < CURRENT_DATE THEN
    RETURN json_build_object('success', false, 'error', 'Cannot book past dates', 'code', 'SLOT_PAST');
  END IF;

  -- Get player details
  SELECT
    form_data->>'playerFullName',
    form_data->>'playerCategory',
    form_data->>'parentEmail',
    form_data->>'parentFullName',
    form_data->>'programType',
    payment_status
  INTO v_player_name, v_player_category, v_parent_email, v_parent_name, v_program_type, v_payment_status
  FROM public.registrations
  WHERE id = p_registration_id AND firebase_uid = p_firebase_uid;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Registration not found', 'code', 'REGISTRATION_NOT_FOUND');
  END IF;

  -- Check program type
  IF v_program_type != 'group' THEN
    RETURN json_build_object('success', false, 'error', 'Only Group Training players can book Sunday practice', 'code', 'INVALID_PROGRAM_TYPE');
  END IF;

  -- Check payment status
  IF v_payment_status NOT IN ('succeeded', 'verified', 'paid') THEN
    RETURN json_build_object('success', false, 'error', 'Active subscription required to book Sunday practice', 'code', 'PAYMENT_REQUIRED');
  END IF;

  -- Check category eligibility
  v_player_category_num := extract_category_number(v_player_category);

  -- FIXED: Changed from M11-M15 to M7-M15
  IF v_player_category_num < 7 OR v_player_category_num > 15 THEN
    RETURN json_build_object('success', false, 'error', 'Only M7-M15 players can book Sunday practice', 'code', 'INELIGIBLE_CATEGORY');
  END IF;

  -- Check if player's category matches slot range
  IF v_player_category_num < extract_category_number(v_min_category) OR
     v_player_category_num > extract_category_number(v_max_category) THEN
    RETURN json_build_object('success', false, 'error', 'Your age category does not match this time slot', 'code', 'CATEGORY_MISMATCH');
  END IF;

  -- Check for existing booking on the same date
  SELECT b.id INTO v_existing_booking
  FROM public.sunday_bookings b
  INNER JOIN public.sunday_practice_slots s ON b.slot_id = s.id
  WHERE b.registration_id = p_registration_id
    AND s.practice_date = v_slot_date
    AND b.booking_status = 'confirmed';

  IF FOUND THEN
    RETURN json_build_object('success', false, 'error', 'You already have a booking for this Sunday', 'code', 'DUPLICATE_BOOKING');
  END IF;

  -- Create the booking
  INSERT INTO public.sunday_bookings (
    slot_id,
    registration_id,
    player_name,
    player_category,
    parent_email,
    parent_name,
    booking_status,
    booked_at
  ) VALUES (
    p_slot_id,
    p_registration_id,
    v_player_name,
    v_player_category,
    v_parent_email,
    v_parent_name,
    'confirmed',
    NOW()
  )
  RETURNING id INTO v_booking_id;

  -- Update slot capacity
  UPDATE public.sunday_practice_slots
  SET
    current_bookings = current_bookings + 1,
    available_spots = max_capacity - (current_bookings + 1),
    updated_at = NOW()
  WHERE id = p_slot_id;

  -- Return success
  RETURN json_build_object(
    'success', true,
    'booking_id', v_booking_id,
    'slot_date', v_slot_date,
    'time_range', CONCAT(TO_CHAR(v_slot_start_time, 'HH12:MI AM'), ' - ', TO_CHAR(v_slot_end_time, 'HH12:MI AM')),
    'message', 'Successfully booked Sunday practice!'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.book_sunday_slot TO anon, authenticated;

COMMENT ON FUNCTION public.book_sunday_slot IS 'Book a Sunday practice slot for M7-M15 Group Training players';
