-- ============================================
-- SUNDAY REAL ICE PRACTICE BOOKING SYSTEM
-- ============================================
-- This schema implements the Sunday ice practice booking system
-- for Group Training players (M11+). Features include:
-- - Weekly slot generation (2 time slots based on age group)
-- - Capacity management (6 players per slot)
-- - Booking and cancellation
-- - Attendance tracking
-- - Admin roster management
--
-- Tables:
--   1. sunday_practice_slots - Weekly generated time slots
--   2. sunday_bookings - Individual player bookings
--
-- Views:
--   1. sunday_bookings_detail - Enriched booking data with player info
--
-- Functions:
--   1. book_sunday_slot() - Book a slot with validation
--   2. cancel_sunday_booking() - Cancel a booking
--   3. get_next_sunday_slot() - Get next available Sunday for eligible players
--   4. generate_sunday_slots() - Auto-generate weekly slots (cron job)

-- ============================================
-- TABLE 1: sunday_practice_slots
-- ============================================
-- Stores weekly Sunday ice practice time slots

DROP TABLE IF EXISTS public.sunday_practice_slots CASCADE;

CREATE TABLE public.sunday_practice_slots (
  -- Primary key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Slot details
  practice_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,

  -- Age group eligibility
  min_category TEXT NOT NULL CHECK (min_category IN ('M11', 'M13', 'M15', 'M18')),
  max_category TEXT NOT NULL CHECK (max_category IN ('M11', 'M13', 'M15', 'M18', 'M13 Elite', 'M15 Elite', 'Junior')),

  -- Capacity management
  max_capacity INTEGER NOT NULL DEFAULT 6,
  current_bookings INTEGER NOT NULL DEFAULT 0,
  available_spots INTEGER GENERATED ALWAYS AS (max_capacity - current_bookings) STORED,

  -- Status
  is_active BOOLEAN NOT NULL DEFAULT true,

  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Constraints
  CONSTRAINT valid_capacity CHECK (current_bookings >= 0 AND current_bookings <= max_capacity),
  CONSTRAINT valid_time_range CHECK (end_time > start_time),
  CONSTRAINT valid_category_range CHECK (
    (min_category = 'M11' AND max_category IN ('M13', 'M13 Elite')) OR
    (min_category = 'M13' AND max_category IN ('M15', 'M15 Elite', 'M18', 'Junior'))
  ),
  CONSTRAINT unique_slot UNIQUE (practice_date, start_time)
);

-- Add indexes for performance
CREATE INDEX idx_sunday_slots_date ON public.sunday_practice_slots(practice_date);
CREATE INDEX idx_sunday_slots_active ON public.sunday_practice_slots(is_active) WHERE is_active = true;
CREATE INDEX idx_sunday_slots_available ON public.sunday_practice_slots(practice_date, available_spots) WHERE is_active = true AND available_spots > 0;

-- Add helpful comment
COMMENT ON TABLE public.sunday_practice_slots IS 'Weekly Sunday ice practice time slots with capacity management';

-- ============================================
-- TABLE 2: sunday_bookings
-- ============================================
-- Stores individual player bookings for Sunday practice

DROP TABLE IF EXISTS public.sunday_bookings CASCADE;

CREATE TABLE public.sunday_bookings (
  -- Primary key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Foreign keys
  slot_id UUID NOT NULL REFERENCES public.sunday_practice_slots(id) ON DELETE CASCADE,
  registration_id UUID NOT NULL REFERENCES public.registrations(id) ON DELETE CASCADE,

  -- Booking details
  player_name TEXT NOT NULL,
  player_category TEXT NOT NULL,
  parent_email TEXT NOT NULL,
  parent_name TEXT NOT NULL,

  -- Status tracking
  booking_status TEXT NOT NULL DEFAULT 'confirmed' CHECK (booking_status IN ('confirmed', 'cancelled', 'attended', 'no-show')),

  -- Attendance tracking (admin only)
  attended BOOLEAN DEFAULT NULL,
  attendance_marked_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  attendance_marked_by TEXT DEFAULT NULL,

  -- Metadata
  booked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  cancelled_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Constraints
  CONSTRAINT unique_booking_per_slot UNIQUE (slot_id, registration_id),
  CONSTRAINT valid_status_transition CHECK (
    (booking_status = 'confirmed' AND cancelled_at IS NULL) OR
    (booking_status = 'cancelled' AND cancelled_at IS NOT NULL) OR
    (booking_status IN ('attended', 'no-show'))
  )
);

-- Add indexes for performance
CREATE INDEX idx_sunday_bookings_slot ON public.sunday_bookings(slot_id);
CREATE INDEX idx_sunday_bookings_registration ON public.sunday_bookings(registration_id);
CREATE INDEX idx_sunday_bookings_status ON public.sunday_bookings(booking_status);
CREATE INDEX idx_sunday_bookings_parent_email ON public.sunday_bookings(parent_email);
CREATE INDEX idx_sunday_bookings_date_lookup ON public.sunday_bookings(slot_id, booking_status) WHERE booking_status = 'confirmed';

-- Add helpful comment
COMMENT ON TABLE public.sunday_bookings IS 'Player bookings for Sunday ice practice sessions with attendance tracking';

-- ============================================
-- VIEW: sunday_bookings_detail
-- ============================================
-- Enriched view combining booking, slot, and registration data

DROP VIEW IF EXISTS public.sunday_bookings_detail;

CREATE OR REPLACE VIEW public.sunday_bookings_detail AS
SELECT
  -- Booking info
  b.id AS booking_id,
  b.booking_status,
  b.booked_at,
  b.cancelled_at,
  b.attended,
  b.attendance_marked_at,
  b.attendance_marked_by,

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
    WHEN b.booking_status = 'attended' THEN 'Attended'
    WHEN b.booking_status = 'no-show' THEN 'No Show'
    WHEN b.booking_status = 'cancelled' THEN 'Cancelled'
    WHEN s.practice_date < CURRENT_DATE THEN 'Past'
    WHEN s.practice_date = CURRENT_DATE THEN 'Today'
    ELSE 'Upcoming'
  END AS booking_display_status

FROM public.sunday_bookings b
INNER JOIN public.sunday_practice_slots s ON b.slot_id = s.id
INNER JOIN public.registrations r ON b.registration_id = r.id
ORDER BY s.practice_date DESC, s.start_time ASC;

-- Add helpful comment
COMMENT ON VIEW public.sunday_bookings_detail IS 'Enriched view of Sunday practice bookings with slot and player details for admin and parent dashboards';

-- ============================================
-- FUNCTION 1: book_sunday_slot
-- ============================================
-- Books a Sunday practice slot with validation

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
  v_min_category TEXT;
  v_max_category TEXT;
  v_available_spots INTEGER;
  v_player_name TEXT;
  v_player_category TEXT;
  v_parent_email TEXT;
  v_parent_name TEXT;
  v_program_type TEXT;
  v_payment_status TEXT;
  v_existing_booking UUID;
  v_booking_id UUID;
BEGIN
  -- 1. Validate slot exists and is active
  SELECT practice_date, start_time, end_time, min_category, max_category, available_spots
  INTO v_slot_date, v_slot_start_time, v_slot_end_time, v_min_category, v_max_category, v_available_spots
  FROM public.sunday_practice_slots
  WHERE id = p_slot_id AND is_active = true;

  IF NOT FOUND THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Slot not found or inactive',
      'code', 'SLOT_NOT_FOUND'
    );
  END IF;

  -- 2. Check if slot has capacity
  IF v_available_spots <= 0 THEN
    RETURN json_build_object(
      'success', false,
      'error', 'This time slot is fully booked',
      'code', 'SLOT_FULL'
    );
  END IF;

  -- 3. Check if slot is in the future
  IF v_slot_date < CURRENT_DATE THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Cannot book past slots',
      'code', 'SLOT_PAST'
    );
  END IF;

  -- 4. Get registration details
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
    RETURN json_build_object(
      'success', false,
      'error', 'Registration not found or unauthorized',
      'code', 'REGISTRATION_NOT_FOUND'
    );
  END IF;

  -- 5. Validate program type (only Group Training)
  IF v_program_type != 'group' THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Only Group Training players can book Sunday practice',
      'code', 'INVALID_PROGRAM_TYPE'
    );
  END IF;

  -- 6. Validate payment status
  IF v_payment_status NOT IN ('succeeded', 'active') THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Active subscription required to book Sunday practice',
      'code', 'PAYMENT_REQUIRED'
    );
  END IF;

  -- 7. Validate player category eligibility (M11+)
  IF v_player_category NOT IN ('M11', 'M13', 'M13 Elite', 'M15', 'M15 Elite', 'M18', 'Junior') THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Only M11+ players can book Sunday practice',
      'code', 'INELIGIBLE_CATEGORY'
    );
  END IF;

  -- 8. Check if player already has a booking for this date
  SELECT id INTO v_existing_booking
  FROM public.sunday_bookings b
  INNER JOIN public.sunday_practice_slots s ON b.slot_id = s.id
  WHERE b.registration_id = p_registration_id
    AND s.practice_date = v_slot_date
    AND b.booking_status = 'confirmed';

  IF FOUND THEN
    RETURN json_build_object(
      'success', false,
      'error', 'You already have a booking for this Sunday',
      'code', 'DUPLICATE_BOOKING'
    );
  END IF;

  -- 9. Create the booking
  INSERT INTO public.sunday_bookings (
    slot_id,
    registration_id,
    player_name,
    player_category,
    parent_email,
    parent_name,
    booking_status
  ) VALUES (
    p_slot_id,
    p_registration_id,
    v_player_name,
    v_player_category,
    v_parent_email,
    v_parent_name,
    'confirmed'
  )
  RETURNING id INTO v_booking_id;

  -- 10. Update slot capacity
  UPDATE public.sunday_practice_slots
  SET
    current_bookings = current_bookings + 1,
    updated_at = NOW()
  WHERE id = p_slot_id;

  -- 11. Return success
  RETURN json_build_object(
    'success', true,
    'booking_id', v_booking_id,
    'slot_date', v_slot_date,
    'time_range', CONCAT(
      TO_CHAR(v_slot_start_time, 'HH12:MI AM'),
      ' - ',
      TO_CHAR(v_slot_end_time, 'HH12:MI AM')
    ),
    'message', 'Booking confirmed successfully'
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

COMMENT ON FUNCTION public.book_sunday_slot IS 'Books a Sunday practice slot with comprehensive validation';

-- ============================================
-- FUNCTION 2: cancel_sunday_booking
-- ============================================
-- Cancels a Sunday practice booking

CREATE OR REPLACE FUNCTION public.cancel_sunday_booking(
  p_booking_id UUID,
  p_firebase_uid TEXT
)
RETURNS JSON AS $$
DECLARE
  v_slot_id UUID;
  v_registration_id UUID;
  v_booking_status TEXT;
  v_slot_date DATE;
BEGIN
  -- 1. Get booking details
  SELECT
    b.slot_id,
    b.registration_id,
    b.booking_status,
    s.practice_date
  INTO v_slot_id, v_registration_id, v_booking_status, v_slot_date
  FROM public.sunday_bookings b
  INNER JOIN public.sunday_practice_slots s ON b.slot_id = s.id
  INNER JOIN public.registrations r ON b.registration_id = r.id
  WHERE b.id = p_booking_id AND r.firebase_uid = p_firebase_uid;

  IF NOT FOUND THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Booking not found or unauthorized',
      'code', 'BOOKING_NOT_FOUND'
    );
  END IF;

  -- 2. Check if already cancelled
  IF v_booking_status = 'cancelled' THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Booking is already cancelled',
      'code', 'ALREADY_CANCELLED'
    );
  END IF;

  -- 3. Check if slot is in the past
  IF v_slot_date < CURRENT_DATE THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Cannot cancel past bookings',
      'code', 'BOOKING_PAST'
    );
  END IF;

  -- 4. Update booking status
  UPDATE public.sunday_bookings
  SET
    booking_status = 'cancelled',
    cancelled_at = NOW(),
    updated_at = NOW()
  WHERE id = p_booking_id;

  -- 5. Update slot capacity
  UPDATE public.sunday_practice_slots
  SET
    current_bookings = current_bookings - 1,
    updated_at = NOW()
  WHERE id = v_slot_id;

  -- 6. Return success
  RETURN json_build_object(
    'success', true,
    'message', 'Booking cancelled successfully'
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

COMMENT ON FUNCTION public.cancel_sunday_booking IS 'Cancels a Sunday practice booking and updates slot capacity';

-- ============================================
-- FUNCTION 3: get_next_sunday_slot
-- ============================================
-- Gets the next available Sunday slot for a player

CREATE OR REPLACE FUNCTION public.get_next_sunday_slot(
  p_registration_id UUID,
  p_firebase_uid TEXT
)
RETURNS JSON AS $$
DECLARE
  v_player_category TEXT;
  v_program_type TEXT;
  v_payment_status TEXT;
  v_next_sunday DATE;
  v_existing_booking UUID;
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
      'success', false,
      'eligible', false,
      'reason', 'Only Group Training players can book Sunday practice'
    );
  END IF;

  IF v_player_category NOT IN ('M11', 'M13', 'M13 Elite', 'M15', 'M15 Elite', 'M18', 'Junior') THEN
    RETURN json_build_object(
      'success', false,
      'eligible', false,
      'reason', 'Only M11+ players can book Sunday practice'
    );
  END IF;

  IF v_payment_status NOT IN ('succeeded', 'active') THEN
    RETURN json_build_object(
      'success', false,
      'eligible', false,
      'reason', 'Active subscription required'
    );
  END IF;

  -- 3. Calculate next Sunday
  v_next_sunday := CURRENT_DATE + ((7 - EXTRACT(DOW FROM CURRENT_DATE)::INTEGER) % 7);
  IF v_next_sunday = CURRENT_DATE THEN
    v_next_sunday := v_next_sunday + 7;
  END IF;

  -- 4. Check if player already has a booking for next Sunday
  SELECT b.id INTO v_existing_booking
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
      'booking_id', v_existing_booking,
      'next_sunday', v_next_sunday
    );
  END IF;

  -- 5. Get available slots for next Sunday
  SELECT json_agg(
    json_build_object(
      'slot_id', id,
      'date', practice_date,
      'start_time', start_time,
      'end_time', end_time,
      'time_range', CONCAT(
        TO_CHAR(start_time, 'HH12:MI AM'),
        ' - ',
        TO_CHAR(end_time, 'HH12:MI AM')
      ),
      'min_category', min_category,
      'max_category', max_category,
      'available_spots', available_spots,
      'max_capacity', max_capacity
    )
  )
  INTO v_slots
  FROM public.sunday_practice_slots
  WHERE practice_date = v_next_sunday
    AND is_active = true
    AND available_spots > 0
  ORDER BY start_time;

  -- 6. Return result
  RETURN json_build_object(
    'success', true,
    'eligible', true,
    'already_booked', false,
    'next_sunday', v_next_sunday,
    'available_slots', COALESCE(v_slots, '[]'::json)
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

COMMENT ON FUNCTION public.get_next_sunday_slot IS 'Gets next available Sunday slot for eligible players with booking status';

-- ============================================
-- FUNCTION 4: generate_sunday_slots
-- ============================================
-- Auto-generates Sunday practice slots for upcoming Sundays (called by cron)

CREATE OR REPLACE FUNCTION public.generate_sunday_slots(
  p_weeks_ahead INTEGER DEFAULT 2
)
RETURNS JSON AS $$
DECLARE
  v_sunday DATE;
  v_week INTEGER;
  v_slots_created INTEGER := 0;
  v_slot_id UUID;
BEGIN
  -- Loop through weeks ahead
  FOR v_week IN 1..p_weeks_ahead LOOP
    -- Calculate Sunday date
    v_sunday := CURRENT_DATE + ((7 - EXTRACT(DOW FROM CURRENT_DATE)::INTEGER) % 7) + (7 * v_week);

    -- Check if slots already exist for this Sunday
    IF EXISTS (
      SELECT 1 FROM public.sunday_practice_slots WHERE practice_date = v_sunday
    ) THEN
      CONTINUE;
    END IF;

    -- Create Slot 1: 7:30-8:30 AM for M11-M13
    INSERT INTO public.sunday_practice_slots (
      practice_date,
      start_time,
      end_time,
      min_category,
      max_category,
      max_capacity,
      current_bookings,
      is_active
    ) VALUES (
      v_sunday,
      '07:30:00'::TIME,
      '08:30:00'::TIME,
      'M11',
      'M13 Elite',
      6,
      0,
      true
    )
    RETURNING id INTO v_slot_id;

    v_slots_created := v_slots_created + 1;

    -- Create Slot 2: 8:30-9:30 AM for M13-M18
    INSERT INTO public.sunday_practice_slots (
      practice_date,
      start_time,
      end_time,
      min_category,
      max_category,
      max_capacity,
      current_bookings,
      is_active
    ) VALUES (
      v_sunday,
      '08:30:00'::TIME,
      '09:30:00'::TIME,
      'M13',
      'Junior',
      6,
      0,
      true
    )
    RETURNING id INTO v_slot_id;

    v_slots_created := v_slots_created + 1;
  END LOOP;

  RETURN json_build_object(
    'success', true,
    'slots_created', v_slots_created,
    'message', CONCAT('Generated ', v_slots_created, ' slots for ', p_weeks_ahead, ' weeks ahead')
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

COMMENT ON FUNCTION public.generate_sunday_slots IS 'Auto-generates Sunday practice slots for upcoming weeks (cron job)';

-- ============================================
-- GRANT PERMISSIONS
-- ============================================

-- Authenticated users can view slots and their own bookings
GRANT SELECT ON public.sunday_practice_slots TO authenticated;
GRANT SELECT ON public.sunday_bookings TO authenticated;
GRANT SELECT ON public.sunday_bookings_detail TO authenticated;

-- Allow authenticated users to execute booking functions
GRANT EXECUTE ON FUNCTION public.book_sunday_slot TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_sunday_booking TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_next_sunday_slot TO authenticated;

-- Service role for cron job
GRANT EXECUTE ON FUNCTION public.generate_sunday_slots TO service_role;

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================

-- Enable RLS on tables
ALTER TABLE public.sunday_practice_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sunday_bookings ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can view active slots
CREATE POLICY "Anyone can view active slots"
  ON public.sunday_practice_slots
  FOR SELECT
  USING (is_active = true);

-- Policy: Users can view their own bookings
CREATE POLICY "Users can view own bookings"
  ON public.sunday_bookings
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.registrations
      WHERE registrations.id = sunday_bookings.registration_id
        AND registrations.firebase_uid = auth.uid()::text
    )
  );

-- Policy: Service role has full access (for cron and admin functions)
CREATE POLICY "Service role full access slots"
  ON public.sunday_practice_slots
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Service role full access bookings"
  ON public.sunday_bookings
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ============================================
-- INITIAL DATA GENERATION
-- ============================================
-- Generate slots for the next 4 weeks

SELECT public.generate_sunday_slots(4);

-- ============================================
-- VERIFICATION QUERIES
-- ============================================

-- Check tables exist
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('sunday_practice_slots', 'sunday_bookings')
ORDER BY table_name;

-- Check view exists
SELECT table_name
FROM information_schema.views
WHERE table_schema = 'public'
  AND table_name = 'sunday_bookings_detail';

-- Check functions exist
SELECT routine_name
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name LIKE '%sunday%'
ORDER BY routine_name;

-- View generated slots
SELECT
  practice_date,
  TO_CHAR(start_time, 'HH12:MI AM') || ' - ' || TO_CHAR(end_time, 'HH12:MI AM') as time_range,
  min_category || ' - ' || max_category as age_group,
  available_spots || '/' || max_capacity as capacity
FROM public.sunday_practice_slots
ORDER BY practice_date, start_time;
