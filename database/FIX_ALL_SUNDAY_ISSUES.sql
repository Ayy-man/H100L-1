-- ============================================================
-- COMPLETE FIX FOR SUNDAY PRACTICE BOOKING
-- ============================================================
-- CORRECT ORDER: Delete old data FIRST, then add constraints
-- ============================================================

-- ============================================================
-- STEP 1: Delete ALL existing Sunday slots first
-- ============================================================
DELETE FROM sunday_practice_slots WHERE practice_date >= '2025-11-01';

-- ============================================================
-- STEP 2: Drop old constraint
-- ============================================================
ALTER TABLE sunday_practice_slots
DROP CONSTRAINT IF EXISTS valid_category_range;

-- ============================================================
-- STEP 3: Add new flexible constraint
-- ============================================================
ALTER TABLE sunday_practice_slots
ADD CONSTRAINT valid_category_range CHECK (
  (min_category = 'M7' AND max_category IN ('M9', 'M11')) OR
  (min_category = 'M11' AND max_category IN ('M13', 'M13 Elite')) OR
  (min_category = 'M13' AND max_category IN ('M15', 'M15 Elite'))
);

-- ============================================================
-- STEP 4: Create helper function
-- ============================================================
CREATE OR REPLACE FUNCTION extract_category_number(category TEXT)
RETURNS INTEGER AS $$
BEGIN
  IF category = 'Junior' THEN RETURN 99; END IF;
  RETURN CAST(SUBSTRING(category FROM 'M([0-9]+)') AS INTEGER);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

GRANT EXECUTE ON FUNCTION extract_category_number TO anon, authenticated;

-- ============================================================
-- STEP 5: Fix get_next_sunday_slot function
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

  v_next_sunday := CURRENT_DATE + ((7 - EXTRACT(DOW FROM CURRENT_DATE)::INTEGER) % 7);
  IF v_next_sunday = CURRENT_DATE THEN
    v_next_sunday := v_next_sunday + 7;
  END IF;

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
    RETURN json_build_object('success', true, 'eligible', true, 'already_booked', true, 'existing_booking', v_existing_booking_slot, 'next_sunday', v_next_sunday);
  END IF;

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

  RETURN json_build_object('success', true, 'eligible', true, 'already_booked', false, 'next_sunday', v_next_sunday, 'available_slots', COALESCE(v_slots, '[]'::json));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.get_next_sunday_slot TO anon, authenticated;

-- ============================================================
-- STEP 6: Fix book_sunday_slot function
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
BEGIN
  SELECT practice_date, start_time, end_time, available_spots
  INTO v_slot_date, v_slot_start_time, v_slot_end_time, v_available_spots
  FROM public.sunday_practice_slots
  WHERE id = p_slot_id AND is_active = true;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Slot not found');
  END IF;

  IF v_available_spots <= 0 THEN
    RETURN json_build_object('success', false, 'error', 'Slot is full');
  END IF;

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
    RETURN json_build_object('success', false, 'error', 'Registration not found');
  END IF;

  IF v_program_type != 'group' THEN
    RETURN json_build_object('success', false, 'error', 'Only Group Training players can book');
  END IF;

  IF v_payment_status NOT IN ('succeeded', 'verified', 'paid') THEN
    RETURN json_build_object('success', false, 'error', 'Active subscription required');
  END IF;

  v_player_category_num := extract_category_number(v_player_category);
  
  IF v_player_category_num < 11 OR v_player_category_num > 15 THEN
    RETURN json_build_object('success', false, 'error', 'Only M11-M15 players can book');
  END IF;

  SELECT b.id INTO v_existing_booking
  FROM public.sunday_bookings b
  INNER JOIN public.sunday_practice_slots s ON b.slot_id = s.id
  WHERE b.registration_id = p_registration_id
    AND s.practice_date = v_slot_date
    AND b.booking_status = 'confirmed';

  IF FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Already booked for this Sunday');
  END IF;

  INSERT INTO public.sunday_bookings (
    slot_id, registration_id, player_name, player_category,
    parent_email, parent_name, booking_status
  ) VALUES (
    p_slot_id, p_registration_id, v_player_name, v_player_category,
    v_parent_email, v_parent_name, 'confirmed'
  )
  RETURNING id INTO v_booking_id;

  UPDATE public.sunday_practice_slots
  SET current_bookings = current_bookings + 1, updated_at = NOW()
  WHERE id = p_slot_id;

  RETURN json_build_object(
    'success', true,
    'booking_id', v_booking_id,
    'slot_date', v_slot_date,
    'time_range', CONCAT(TO_CHAR(v_slot_start_time, 'HH12:MI AM'), ' - ', TO_CHAR(v_slot_end_time, 'HH12:MI AM'))
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.book_sunday_slot TO anon, authenticated;

-- ============================================================
-- STEP 7: Create fresh slots for Nov 23
-- ============================================================
INSERT INTO sunday_practice_slots (
  practice_date, start_time, end_time,
  min_category, max_category,
  max_capacity, current_bookings, is_active
) VALUES
  ('2025-11-23', '07:30:00', '08:30:00', 'M7', 'M11', 12, 0, true),
  ('2025-11-23', '08:30:00', '09:30:00', 'M13', 'M15', 10, 0, true);

-- ============================================================
-- VERIFICATION
-- ============================================================
SELECT practice_date, TO_CHAR(start_time, 'HH12:MI AM') || ' - ' || TO_CHAR(end_time, 'HH12:MI AM') as time,
  min_category || '-' || max_category as ages, max_capacity
FROM sunday_practice_slots WHERE practice_date >= CURRENT_DATE ORDER BY practice_date, start_time;

DO $$
BEGIN
  RAISE NOTICE '✅ ALL FIXED!';
  RAISE NOTICE '  7:30-8:30 AM: M7-M11 (12 kids)';
  RAISE NOTICE '  8:30-9:30 AM: M13-M15 (10 kids)';
  RAISE NOTICE '  M18: NOT ELIGIBLE';
END $$;
