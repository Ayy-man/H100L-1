-- ============================================
-- CREATE SUNDAY PRACTICE TABLES
-- ============================================
-- Run this FIRST before FIX_SUNDAY_SLOTS_GENERATION.sql
-- ============================================

-- Helper function to extract category number
CREATE OR REPLACE FUNCTION public.extract_category_number(category TEXT)
RETURNS INTEGER AS $$
BEGIN
  RETURN CASE
    WHEN category LIKE 'M%' THEN
      CAST(regexp_replace(category, '[^0-9]', '', 'g') AS INTEGER)
    WHEN category = 'Junior' THEN 18
    WHEN category = 'Unknown' THEN 0
    ELSE 0
  END;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ============================================
-- TABLE 1: sunday_practice_slots
-- ============================================
CREATE TABLE IF NOT EXISTS public.sunday_practice_slots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  practice_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  min_category TEXT NOT NULL,
  max_category TEXT NOT NULL,
  max_capacity INTEGER NOT NULL DEFAULT 12,
  current_bookings INTEGER NOT NULL DEFAULT 0,
  available_spots INTEGER NOT NULL DEFAULT 12,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT valid_capacity CHECK (current_bookings >= 0 AND current_bookings <= max_capacity),
  CONSTRAINT valid_time_range CHECK (end_time > start_time),
  CONSTRAINT unique_slot UNIQUE (practice_date, start_time)
);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_sunday_slots_date ON public.sunday_practice_slots(practice_date);
CREATE INDEX IF NOT EXISTS idx_sunday_slots_active ON public.sunday_practice_slots(is_active) WHERE is_active = true;

COMMENT ON TABLE public.sunday_practice_slots IS 'Weekly Sunday ice practice time slots';

-- ============================================
-- TABLE 2: sunday_bookings
-- ============================================
CREATE TABLE IF NOT EXISTS public.sunday_bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slot_id UUID NOT NULL REFERENCES public.sunday_practice_slots(id) ON DELETE CASCADE,
  registration_id UUID NOT NULL REFERENCES public.registrations(id) ON DELETE CASCADE,
  player_name TEXT NOT NULL,
  player_category TEXT NOT NULL,
  parent_email TEXT NOT NULL,
  parent_name TEXT NOT NULL,
  booking_status TEXT NOT NULL DEFAULT 'confirmed' CHECK (booking_status IN ('confirmed', 'cancelled', 'attended', 'no-show')),
  attended BOOLEAN DEFAULT NULL,
  attendance_status TEXT DEFAULT 'pending',
  attendance_marked_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  attendance_marked_by TEXT DEFAULT NULL,
  attendance_notes TEXT DEFAULT NULL,
  booked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  cancelled_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT unique_booking_per_slot UNIQUE (slot_id, registration_id)
);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_sunday_bookings_slot ON public.sunday_bookings(slot_id);
CREATE INDEX IF NOT EXISTS idx_sunday_bookings_registration ON public.sunday_bookings(registration_id);
CREATE INDEX IF NOT EXISTS idx_sunday_bookings_status ON public.sunday_bookings(booking_status);

COMMENT ON TABLE public.sunday_bookings IS 'Player bookings for Sunday ice practice sessions';

-- ============================================
-- FUNCTION: generate_sunday_slots
-- ============================================
CREATE OR REPLACE FUNCTION public.generate_sunday_slots(
  p_weeks_ahead INTEGER DEFAULT 4
)
RETURNS JSON AS $$
DECLARE
  v_sunday DATE;
  v_week INTEGER;
  v_slots_created INTEGER := 0;
BEGIN
  FOR v_week IN 0..(p_weeks_ahead - 1) LOOP
    IF EXTRACT(DOW FROM CURRENT_DATE) = 0 THEN
      v_sunday := CURRENT_DATE + (7 * v_week);
    ELSE
      v_sunday := CURRENT_DATE + (7 - EXTRACT(DOW FROM CURRENT_DATE)::INTEGER) + (7 * v_week);
    END IF;

    IF EXISTS (SELECT 1 FROM public.sunday_practice_slots WHERE practice_date = v_sunday) THEN
      CONTINUE;
    END IF;

    -- Slot 1: 7:30-8:30 AM for M7, M9, M11 (capacity 12)
    INSERT INTO public.sunday_practice_slots (
      practice_date, start_time, end_time, min_category, max_category,
      max_capacity, current_bookings, available_spots, is_active
    ) VALUES (
      v_sunday, '07:30:00'::TIME, '08:30:00'::TIME, 'M7', 'M11',
      12, 0, 12, true
    );
    v_slots_created := v_slots_created + 1;

    -- Slot 2: 8:30-9:30 AM for M13, M15 (capacity 10)
    INSERT INTO public.sunday_practice_slots (
      practice_date, start_time, end_time, min_category, max_category,
      max_capacity, current_bookings, available_spots, is_active
    ) VALUES (
      v_sunday, '08:30:00'::TIME, '09:30:00'::TIME, 'M13', 'M15 Elite',
      10, 0, 10, true
    );
    v_slots_created := v_slots_created + 1;
  END LOOP;

  RETURN json_build_object(
    'success', true,
    'slots_created', v_slots_created,
    'message', 'Generated ' || v_slots_created || ' slots'
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.generate_sunday_slots TO authenticated;

-- ============================================
-- FUNCTION: get_upcoming_sunday_slots
-- ============================================
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

  IF v_player_category_num < 7 OR v_player_category_num > 15 THEN
    RETURN json_build_object('success', true, 'eligible', false, 'reason', 'Only M7-M15 players can book Sunday practice');
  END IF;

  IF v_payment_status NOT IN ('succeeded', 'verified', 'paid', 'active') THEN
    RETURN json_build_object('success', true, 'eligible', false, 'reason', 'Active subscription required');
  END IF;

  v_current_time := CURRENT_TIME;

  IF EXTRACT(DOW FROM CURRENT_DATE) = 0 THEN
    IF v_current_time >= '09:30:00'::TIME THEN
      v_current_sunday := CURRENT_DATE + 7;
    ELSE
      v_current_sunday := CURRENT_DATE;
    END IF;
  ELSE
    v_current_sunday := CURRENT_DATE + ((7 - EXTRACT(DOW FROM CURRENT_DATE)::INTEGER) % 7);
    IF v_current_sunday = CURRENT_DATE THEN
      v_current_sunday := v_current_sunday + 7;
    END IF;
  END IF;

  WITH sunday_weeks AS (
    SELECT generate_series(
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
      EXISTS(
        SELECT 1 FROM public.sunday_bookings b
        WHERE b.registration_id = p_registration_id
          AND b.slot_id = s.id
          AND b.booking_status = 'confirmed'
      ) AS player_booked,
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
      AND NOT (s.practice_date = CURRENT_DATE AND s.end_time <= CURRENT_TIME)
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

-- ============================================
-- FUNCTION: book_sunday_slot
-- ============================================
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
  SELECT practice_date, start_time, end_time, available_spots, min_category, max_category
  INTO v_slot_date, v_slot_start_time, v_slot_end_time, v_available_spots, v_min_category, v_max_category
  FROM public.sunday_practice_slots
  WHERE id = p_slot_id AND is_active = true;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Slot not found', 'code', 'SLOT_NOT_FOUND');
  END IF;

  IF v_available_spots <= 0 THEN
    RETURN json_build_object('success', false, 'error', 'Slot is full', 'code', 'SLOT_FULL');
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
    RETURN json_build_object('success', false, 'error', 'Registration not found', 'code', 'REG_NOT_FOUND');
  END IF;

  IF v_program_type != 'group' THEN
    RETURN json_build_object('success', false, 'error', 'Only Group Training allowed', 'code', 'INVALID_PROGRAM');
  END IF;

  IF v_payment_status NOT IN ('succeeded', 'verified', 'paid', 'active') THEN
    RETURN json_build_object('success', false, 'error', 'Active subscription required', 'code', 'PAYMENT_REQUIRED');
  END IF;

  v_player_category_num := extract_category_number(v_player_category);

  IF v_player_category_num < extract_category_number(v_min_category) OR
     v_player_category_num > extract_category_number(v_max_category) THEN
    RETURN json_build_object('success', false, 'error', 'Category mismatch for this slot', 'code', 'CATEGORY_MISMATCH');
  END IF;

  SELECT b.id INTO v_existing_booking
  FROM public.sunday_bookings b
  INNER JOIN public.sunday_practice_slots s ON b.slot_id = s.id
  WHERE b.registration_id = p_registration_id
    AND s.practice_date = v_slot_date
    AND b.booking_status = 'confirmed';

  IF FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Already booked for this Sunday', 'code', 'DUPLICATE');
  END IF;

  INSERT INTO public.sunday_bookings (
    slot_id, registration_id, player_name, player_category,
    parent_email, parent_name, booking_status, booked_at
  ) VALUES (
    p_slot_id, p_registration_id, v_player_name, v_player_category,
    v_parent_email, v_parent_name, 'confirmed', NOW()
  )
  RETURNING id INTO v_booking_id;

  UPDATE public.sunday_practice_slots
  SET current_bookings = current_bookings + 1,
      available_spots = max_capacity - (current_bookings + 1),
      updated_at = NOW()
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

-- ============================================
-- FUNCTION: cancel_sunday_booking
-- ============================================
CREATE OR REPLACE FUNCTION public.cancel_sunday_booking(
  p_booking_id UUID,
  p_registration_id UUID,
  p_firebase_uid TEXT
)
RETURNS JSON AS $$
DECLARE
  v_slot_id UUID;
  v_booking_status TEXT;
BEGIN
  SELECT slot_id, booking_status
  INTO v_slot_id, v_booking_status
  FROM public.sunday_bookings
  WHERE id = p_booking_id AND registration_id = p_registration_id;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Booking not found');
  END IF;

  IF v_booking_status = 'cancelled' THEN
    RETURN json_build_object('success', false, 'error', 'Already cancelled');
  END IF;

  UPDATE public.sunday_bookings
  SET booking_status = 'cancelled', cancelled_at = NOW(), updated_at = NOW()
  WHERE id = p_booking_id;

  UPDATE public.sunday_practice_slots
  SET current_bookings = current_bookings - 1,
      available_spots = max_capacity - (current_bookings - 1),
      updated_at = NOW()
  WHERE id = v_slot_id;

  RETURN json_build_object('success', true, 'message', 'Booking cancelled');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.cancel_sunday_booking TO anon, authenticated;

-- ============================================
-- GENERATE INITIAL SLOTS
-- ============================================
SELECT public.generate_sunday_slots(4);

-- Verify
SELECT
  practice_date,
  TO_CHAR(start_time, 'HH12:MI AM') || ' - ' || TO_CHAR(end_time, 'HH12:MI AM') as time_slot,
  min_category || ' to ' || max_category as categories,
  available_spots || '/' || max_capacity as capacity
FROM public.sunday_practice_slots
WHERE practice_date >= CURRENT_DATE
ORDER BY practice_date, start_time;

SELECT 'Sunday practice tables created and slots generated!' as status;
