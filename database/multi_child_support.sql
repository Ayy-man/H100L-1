-- ============================================
-- MULTI-CHILD SUPPORT MIGRATION
-- ============================================
-- Enables multiple child registrations per parent Firebase account
-- Run this on Supabase SQL Editor
-- Date: 2025-11-23
-- ============================================

BEGIN;

-- ============================================
-- 1. REMOVE UNIQUE CONSTRAINT ON firebase_uid
-- ============================================
-- This allows multiple registrations per parent

ALTER TABLE public.registrations
DROP CONSTRAINT IF EXISTS registrations_firebase_uid_unique;

-- Keep the index for performance, but make it non-unique
DROP INDEX IF EXISTS idx_registrations_firebase_uid;

CREATE INDEX IF NOT EXISTS idx_registrations_firebase_uid
ON public.registrations(firebase_uid)
WHERE firebase_uid IS NOT NULL;

-- ============================================
-- 2. ADD PROFILE DISPLAY NAME FUNCTION
-- ============================================
-- Generates display name: "PlayerName - ProgramType Frequency"
-- Examples: "Alex - Group 2X", "Sarah - Private", "Michael - Semi-Private"

CREATE OR REPLACE FUNCTION public.get_profile_display_name(reg public.registrations)
RETURNS TEXT AS $$
DECLARE
  player_name TEXT;
  program_type TEXT;
  frequency TEXT;
  display_name TEXT;
BEGIN
  -- Extract player name
  player_name := reg.form_data->>'playerFullName';

  -- Extract and format program type
  program_type := reg.form_data->>'programType';
  program_type := INITCAP(program_type); -- Capitalize first letter

  -- Extract frequency based on program type
  IF program_type = 'Group' THEN
    frequency := UPPER(reg.form_data->>'groupFrequency'); -- "1X" or "2X"
    display_name := player_name || ' - ' || program_type || ' ' || frequency;
  ELSIF program_type = 'Private' THEN
    frequency := reg.form_data->>'privateFrequency';
    IF frequency IS NOT NULL AND frequency != 'one-time' THEN
      display_name := player_name || ' - ' || program_type || ' ' || UPPER(frequency);
    ELSE
      display_name := player_name || ' - ' || program_type;
    END IF;
  ELSIF program_type = 'Semi-private' THEN
    display_name := player_name || ' - Semi-Private';
  ELSE
    display_name := player_name || ' - ' || COALESCE(program_type, 'Unknown');
  END IF;

  RETURN display_name;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================
-- 3. CREATE HELPER FUNCTION: Verify Ownership
-- ============================================
-- Validates that a registration belongs to a Firebase user

CREATE OR REPLACE FUNCTION public.verify_registration_ownership(
  p_registration_id UUID,
  p_firebase_uid TEXT
)
RETURNS BOOLEAN AS $$
DECLARE
  v_owner_uid TEXT;
BEGIN
  -- Get the firebase_uid for this registration
  SELECT firebase_uid INTO v_owner_uid
  FROM public.registrations
  WHERE id = p_registration_id;

  -- Check if registration exists and belongs to the user
  IF v_owner_uid IS NULL THEN
    RETURN FALSE; -- Registration doesn't exist
  END IF;

  RETURN v_owner_uid = p_firebase_uid;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- ============================================
-- 4. UPDATE REGISTRATIONS VIEW
-- ============================================
-- Add profile_display_name to the view

DROP VIEW IF EXISTS public.registrations_view CASCADE;

CREATE OR REPLACE VIEW public.registrations_view AS
SELECT
  -- Core registration fields
  r.id,
  r.created_at,
  r.updated_at,
  r.payment_status,
  r.payment_method_id,
  r.stripe_customer_id,
  r.stripe_subscription_id,
  r.canceled_at,

  -- Firebase authentication fields
  r.firebase_uid,
  r.parent_email,
  r.firebase_user_created_at,

  -- Manual confirmation fields
  r.manually_confirmed,
  r.manually_confirmed_by,
  r.manually_confirmed_at,
  r.manually_confirmed_reason,

  -- Profile display name (NEW)
  public.get_profile_display_name(r) AS profile_display_name,

  -- Extracted player information
  (r.form_data->>'playerFullName')::text AS player_name,
  (r.form_data->>'dateOfBirth')::text AS date_of_birth,
  (r.form_data->>'playerCategory')::text AS player_category,

  -- Extracted parent/guardian information
  (r.form_data->>'parentFullName')::text AS parent_name,
  (r.form_data->>'parentEmail')::text AS parent_email_from_form,
  (r.form_data->>'parentPhone')::text AS parent_phone,
  (r.form_data->>'parentCity')::text AS parent_city,
  (r.form_data->>'parentPostalCode')::text AS parent_postal_code,

  -- Program information
  (r.form_data->>'programType')::text AS program_type,
  (r.form_data->>'groupFrequency')::text AS group_frequency,
  (r.form_data->>'privateFrequency')::text AS private_frequency,

  -- Full form data
  r.form_data
FROM public.registrations r;

-- ============================================
-- 5. UPDATE book_sunday_slot FUNCTION
-- ============================================
-- Add ownership validation to Sunday booking

CREATE OR REPLACE FUNCTION public.book_sunday_slot(
  p_slot_id UUID,
  p_registration_id UUID,
  p_firebase_uid TEXT
)
RETURNS JSON AS $$
DECLARE
  v_slot RECORD;
  v_registration RECORD;
  v_booking_id UUID;
  v_existing_booking UUID;
  v_category_order INTEGER;
  v_min_order INTEGER;
  v_max_order INTEGER;
BEGIN
  -- 1. VERIFY OWNERSHIP
  IF NOT public.verify_registration_ownership(p_registration_id, p_firebase_uid) THEN
    RETURN json_build_object(
      'success', false,
      'error', 'You do not have permission to book for this registration',
      'code', 'OWNERSHIP_VERIFICATION_FAILED'
    );
  END IF;

  -- 2. FETCH AND VALIDATE SLOT
  SELECT * INTO v_slot
  FROM public.sunday_practice_slots
  WHERE id = p_slot_id;

  IF NOT FOUND THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Sunday practice slot not found',
      'code', 'SLOT_NOT_FOUND'
    );
  END IF;

  IF NOT v_slot.is_active THEN
    RETURN json_build_object(
      'success', false,
      'error', 'This slot is not active',
      'code', 'SLOT_INACTIVE'
    );
  END IF;

  IF v_slot.available_spots <= 0 THEN
    RETURN json_build_object(
      'success', false,
      'error', 'This slot is full',
      'code', 'SLOT_FULL'
    );
  END IF;

  IF v_slot.practice_date < CURRENT_DATE THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Cannot book past Sunday practices',
      'code', 'SLOT_PAST'
    );
  END IF;

  -- 3. FETCH AND VALIDATE REGISTRATION
  SELECT * INTO v_registration
  FROM public.registrations
  WHERE id = p_registration_id;

  IF NOT FOUND THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Registration not found',
      'code', 'REGISTRATION_NOT_FOUND'
    );
  END IF;

  -- 4. VALIDATE PROGRAM TYPE
  IF (v_registration.form_data->>'programType') != 'group' THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Only group training members can book Sunday practice',
      'code', 'INVALID_PROGRAM_TYPE'
    );
  END IF;

  -- 5. VALIDATE PAYMENT STATUS
  IF v_registration.payment_status NOT IN ('succeeded', 'verified') THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Payment must be completed before booking Sunday practice',
      'code', 'PAYMENT_REQUIRED'
    );
  END IF;

  -- 6. VALIDATE PLAYER CATEGORY
  -- Category order: M7=7, M9=9, M11=11, M13=13, M15=15, M18=18
  v_category_order := CAST(REGEXP_REPLACE(v_registration.form_data->>'playerCategory', '[^0-9]', '', 'g') AS INTEGER);
  v_min_order := CAST(REGEXP_REPLACE(v_slot.min_category, '[^0-9]', '', 'g') AS INTEGER);
  v_max_order := CAST(REGEXP_REPLACE(v_slot.max_category, '[^0-9]', '', 'g') AS INTEGER);

  IF v_category_order < v_min_order OR v_category_order > v_max_order THEN
    RETURN json_build_object(
      'success', false,
      'error', FORMAT('This slot is for %s to %s. Your player is %s.',
                     v_slot.min_category, v_slot.max_category,
                     v_registration.form_data->>'playerCategory'),
      'code', 'INELIGIBLE_CATEGORY'
    );
  END IF;

  -- 7. CHECK FOR DUPLICATE BOOKING (same registration, same Sunday)
  SELECT id INTO v_existing_booking
  FROM public.sunday_bookings
  WHERE registration_id = p_registration_id
    AND slot_id IN (
      SELECT id FROM public.sunday_practice_slots
      WHERE practice_date = v_slot.practice_date
    )
    AND booking_status = 'confirmed';

  IF FOUND THEN
    RETURN json_build_object(
      'success', false,
      'error', 'You already have a booking for this Sunday',
      'code', 'DUPLICATE_BOOKING'
    );
  END IF;

  -- 8. CREATE BOOKING
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
    v_registration.form_data->>'playerFullName',
    v_registration.form_data->>'playerCategory',
    v_registration.form_data->>'parentEmail',
    v_registration.form_data->>'parentFullName',
    'confirmed',
    NOW()
  )
  RETURNING id INTO v_booking_id;

  -- 9. UPDATE SLOT CAPACITY
  UPDATE public.sunday_practice_slots
  SET current_bookings = current_bookings + 1,
      updated_at = NOW()
  WHERE id = p_slot_id;

  -- 10. RETURN SUCCESS
  RETURN json_build_object(
    'success', true,
    'booking_id', v_booking_id,
    'slot_date', v_slot.practice_date,
    'time_range', TO_CHAR(v_slot.start_time, 'HH12:MI AM') || ' - ' || TO_CHAR(v_slot.end_time, 'HH12:MI AM'),
    'message', 'Successfully booked Sunday practice'
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

-- ============================================
-- 6. UPDATE cancel_sunday_booking FUNCTION
-- ============================================

CREATE OR REPLACE FUNCTION public.cancel_sunday_booking(
  p_booking_id UUID,
  p_registration_id UUID,
  p_firebase_uid TEXT
)
RETURNS JSON AS $$
DECLARE
  v_booking RECORD;
  v_slot_id UUID;
BEGIN
  -- 1. VERIFY OWNERSHIP
  IF NOT public.verify_registration_ownership(p_registration_id, p_firebase_uid) THEN
    RETURN json_build_object(
      'success', false,
      'error', 'You do not have permission to cancel this booking',
      'code', 'OWNERSHIP_VERIFICATION_FAILED'
    );
  END IF;

  -- 2. FETCH BOOKING
  SELECT * INTO v_booking
  FROM public.sunday_bookings
  WHERE id = p_booking_id
    AND registration_id = p_registration_id;

  IF NOT FOUND THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Booking not found or does not belong to this registration',
      'code', 'BOOKING_NOT_FOUND'
    );
  END IF;

  IF v_booking.booking_status = 'cancelled' THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Booking is already cancelled',
      'code', 'ALREADY_CANCELLED'
    );
  END IF;

  -- 3. UPDATE BOOKING STATUS
  UPDATE public.sunday_bookings
  SET booking_status = 'cancelled',
      cancelled_at = NOW(),
      updated_at = NOW()
  WHERE id = p_booking_id;

  -- 4. UPDATE SLOT CAPACITY
  UPDATE public.sunday_practice_slots
  SET current_bookings = GREATEST(current_bookings - 1, 0),
      updated_at = NOW()
  WHERE id = v_booking.slot_id;

  -- 5. RETURN SUCCESS
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

-- ============================================
-- 7. CREATE get_upcoming_sunday_slots FUNCTION
-- ============================================
-- Updated to validate ownership

CREATE OR REPLACE FUNCTION public.get_upcoming_sunday_slots(
  p_registration_id UUID,
  p_firebase_uid TEXT,
  p_num_weeks INTEGER DEFAULT 2
)
RETURNS JSON AS $$
DECLARE
  v_registration RECORD;
  v_category_order INTEGER;
  v_eligible BOOLEAN;
  v_ineligibility_reason TEXT;
  v_weeks JSON;
BEGIN
  -- Validate num_weeks parameter
  IF p_num_weeks < 1 OR p_num_weeks > 4 THEN
    RETURN json_build_object(
      'success', false,
      'error', 'num_weeks must be between 1 and 4',
      'code', 'INVALID_PARAMETER'
    );
  END IF;

  -- 1. VERIFY OWNERSHIP
  IF NOT public.verify_registration_ownership(p_registration_id, p_firebase_uid) THEN
    RETURN json_build_object(
      'success', false,
      'error', 'You do not have permission to access this registration',
      'code', 'OWNERSHIP_VERIFICATION_FAILED'
    );
  END IF;

  -- 2. FETCH REGISTRATION
  SELECT * INTO v_registration
  FROM public.registrations
  WHERE id = p_registration_id;

  IF NOT FOUND THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Registration not found',
      'code', 'REGISTRATION_NOT_FOUND'
    );
  END IF;

  -- 3. CHECK ELIGIBILITY
  v_eligible := true;
  v_ineligibility_reason := NULL;

  -- Check program type
  IF (v_registration.form_data->>'programType') != 'group' THEN
    v_eligible := false;
    v_ineligibility_reason := 'Only group training members can book Sunday practice';
  END IF;

  -- Check payment status
  IF v_eligible AND v_registration.payment_status NOT IN ('succeeded', 'verified') THEN
    v_eligible := false;
    v_ineligibility_reason := 'Payment must be completed before booking Sunday practice';
  END IF;

  -- Check category (M11 and above only)
  IF v_eligible THEN
    v_category_order := CAST(REGEXP_REPLACE(
      v_registration.form_data->>'playerCategory', '[^0-9]', '', 'g'
    ) AS INTEGER);

    IF v_category_order < 11 THEN
      v_eligible := false;
      v_ineligibility_reason := FORMAT(
        '%s category is not eligible. Sunday practice is for M11 and above.',
        v_registration.form_data->>'playerCategory'
      );
    END IF;
  END IF;

  -- 4. BUILD WEEKS ARRAY
  SELECT json_agg(week_data ORDER BY week_start)
  INTO v_weeks
  FROM (
    SELECT
      week_start,
      json_agg(
        json_build_object(
          'slot_id', s.id,
          'slot_date', s.practice_date,
          'start_time', s.start_time,
          'end_time', s.end_time,
          'time_range', TO_CHAR(s.start_time, 'HH12:MI AM') || ' - ' || TO_CHAR(s.end_time, 'HH12:MI AM'),
          'min_category', s.min_category,
          'max_category', s.max_category,
          'capacity', s.max_capacity,
          'current_bookings', s.current_bookings,
          'spots_remaining', s.available_spots,
          'is_booked', EXISTS(
            SELECT 1 FROM public.sunday_bookings b
            WHERE b.slot_id = s.id
              AND b.registration_id = p_registration_id
              AND b.booking_status = 'confirmed'
          )
        ) ORDER BY s.start_time
      ) AS slots
    FROM (
      SELECT DISTINCT DATE_TRUNC('week', practice_date)::DATE AS week_start
      FROM public.sunday_practice_slots
      WHERE practice_date >= CURRENT_DATE
        AND practice_date < CURRENT_DATE + (p_num_weeks * 7)
        AND is_active = true
      ORDER BY week_start
      LIMIT p_num_weeks
    ) weeks
    LEFT JOIN public.sunday_practice_slots s
      ON s.practice_date >= weeks.week_start
      AND s.practice_date < weeks.week_start + 7
      AND s.is_active = true
    GROUP BY week_start
  ) week_data;

  -- 5. RETURN RESPONSE
  RETURN json_build_object(
    'success', true,
    'eligible', v_eligible,
    'reason', v_ineligibility_reason,
    'weeks', COALESCE(v_weeks, '[]'::json)
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'success', false,
      'error', SQLERRM,
      'code', 'DATABASE_ERROR'
    );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- ============================================
-- 8. CREATE get_next_sunday_slot FUNCTION
-- ============================================
-- Gets next available Sunday slot (legacy function for backward compatibility)

CREATE OR REPLACE FUNCTION public.get_next_sunday_slot(
  p_registration_id UUID,
  p_firebase_uid TEXT
)
RETURNS JSON AS $$
DECLARE
  v_registration RECORD;
  v_category_order INTEGER;
  v_eligible BOOLEAN;
  v_ineligibility_reason TEXT;
  v_next_sunday DATE;
  v_slots JSON;
  v_existing_booking RECORD;
BEGIN
  -- 1. VERIFY OWNERSHIP
  IF NOT public.verify_registration_ownership(p_registration_id, p_firebase_uid) THEN
    RETURN json_build_object(
      'success', false,
      'error', 'You do not have permission to access this registration',
      'code', 'OWNERSHIP_VERIFICATION_FAILED'
    );
  END IF;

  -- 2. FETCH REGISTRATION
  SELECT * INTO v_registration
  FROM public.registrations
  WHERE id = p_registration_id;

  IF NOT FOUND THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Registration not found',
      'code', 'REGISTRATION_NOT_FOUND'
    );
  END IF;

  -- 3. CHECK ELIGIBILITY
  v_eligible := true;
  v_ineligibility_reason := NULL;

  IF (v_registration.form_data->>'programType') != 'group' THEN
    v_eligible := false;
    v_ineligibility_reason := 'Only group training members can book Sunday practice';
  END IF;

  IF v_eligible AND v_registration.payment_status NOT IN ('succeeded', 'verified') THEN
    v_eligible := false;
    v_ineligibility_reason := 'Payment must be completed before booking Sunday practice';
  END IF;

  IF v_eligible THEN
    v_category_order := CAST(REGEXP_REPLACE(
      v_registration.form_data->>'playerCategory', '[^0-9]', '', 'g'
    ) AS INTEGER);

    IF v_category_order < 11 THEN
      v_eligible := false;
      v_ineligibility_reason := FORMAT(
        '%s category is not eligible. Sunday practice is for M11 and above.',
        v_registration.form_data->>'playerCategory'
      );
    END IF;
  END IF;

  -- 4. FIND NEXT SUNDAY
  v_next_sunday := (
    SELECT MIN(practice_date)
    FROM public.sunday_practice_slots
    WHERE practice_date >= CURRENT_DATE
      AND is_active = true
  );

  -- 5. CHECK FOR EXISTING BOOKING
  SELECT * INTO v_existing_booking
  FROM public.sunday_bookings
  WHERE registration_id = p_registration_id
    AND booking_status = 'confirmed'
    AND slot_id IN (
      SELECT id FROM public.sunday_practice_slots
      WHERE practice_date = v_next_sunday
    );

  -- 6. GET AVAILABLE SLOTS FOR NEXT SUNDAY
  SELECT json_agg(
    json_build_object(
      'slot_id', s.id,
      'slot_date', s.practice_date,
      'start_time', s.start_time,
      'end_time', s.end_time,
      'capacity', s.max_capacity,
      'current_bookings', s.current_bookings,
      'spots_remaining', s.available_spots
    ) ORDER BY s.start_time
  )
  INTO v_slots
  FROM public.sunday_practice_slots s
  WHERE s.practice_date = v_next_sunday
    AND s.is_active = true;

  -- 7. RETURN RESPONSE
  RETURN json_build_object(
    'success', true,
    'eligible', v_eligible,
    'already_booked', v_existing_booking.id IS NOT NULL,
    'next_sunday', v_next_sunday,
    'available_slots', COALESCE(v_slots, '[]'::json),
    'existing_booking', CASE
      WHEN v_existing_booking.id IS NOT NULL THEN
        json_build_object(
          'booking_id', v_existing_booking.id,
          'slot_date', (SELECT practice_date FROM public.sunday_practice_slots WHERE id = v_existing_booking.slot_id),
          'start_time', (SELECT start_time FROM public.sunday_practice_slots WHERE id = v_existing_booking.slot_id),
          'end_time', (SELECT end_time FROM public.sunday_practice_slots WHERE id = v_existing_booking.slot_id)
        )
      ELSE NULL
    END,
    'reason', v_ineligibility_reason
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'success', false,
      'error', SQLERRM,
      'code', 'DATABASE_ERROR'
    );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- ============================================
-- 9. UPDATE RLS POLICIES
-- ============================================
-- Update Row Level Security to allow multi-child access

-- Drop existing policies
DROP POLICY IF EXISTS parent_access ON public.registrations;
DROP POLICY IF EXISTS parent_sunday_bookings_access ON public.sunday_bookings;

-- Recreate with multi-child support
CREATE POLICY parent_access ON public.registrations
  FOR SELECT
  USING (
    firebase_uid = current_setting('request.jwt.claims', true)::json->>'sub'
    OR auth.uid() = firebase_uid
  );

CREATE POLICY parent_sunday_bookings_access ON public.sunday_bookings
  FOR SELECT
  USING (
    registration_id IN (
      SELECT id FROM public.registrations
      WHERE firebase_uid = current_setting('request.jwt.claims', true)::json->>'sub'
         OR auth.uid() = firebase_uid
    )
  );

-- ============================================
-- 10. CREATE INDEXES FOR MULTI-CHILD QUERIES
-- ============================================

-- Index for fetching all children by firebase_uid
CREATE INDEX IF NOT EXISTS idx_registrations_firebase_uid_created
ON public.registrations(firebase_uid, created_at)
WHERE firebase_uid IS NOT NULL;

-- Index for Sunday bookings by registration
CREATE INDEX IF NOT EXISTS idx_sunday_bookings_registration_status
ON public.sunday_bookings(registration_id, booking_status);

-- ============================================
-- 11. ADD COMMENTS FOR DOCUMENTATION
-- ============================================

COMMENT ON COLUMN public.registrations.firebase_uid IS
  'Firebase UID of the parent. Multiple registrations can share the same firebase_uid for multi-child support.';

COMMENT ON FUNCTION public.get_profile_display_name IS
  'Generates a display name for a registration in format: "PlayerName - ProgramType Frequency"';

COMMENT ON FUNCTION public.verify_registration_ownership IS
  'Validates that a registration belongs to the specified Firebase user. Returns true if valid, false otherwise.';

-- ============================================
-- COMMIT TRANSACTION
-- ============================================

COMMIT;

-- ============================================
-- VERIFICATION QUERIES
-- ============================================
-- Run these after migration to verify changes

-- 1. Verify UNIQUE constraint is removed
SELECT constraint_name, constraint_type
FROM information_schema.table_constraints
WHERE table_name = 'registrations' AND constraint_name LIKE '%firebase_uid%';
-- Should return 0 rows

-- 2. Test profile display name function
SELECT
  id,
  firebase_uid,
  public.get_profile_display_name(r.*) AS profile_display_name,
  form_data->>'playerFullName' AS player_name,
  form_data->>'programType' AS program_type
FROM public.registrations r
LIMIT 5;

-- 3. Verify registrations_view includes profile_display_name
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'registrations_view' AND column_name = 'profile_display_name';
-- Should return 1 row

-- 4. Test ownership verification
SELECT public.verify_registration_ownership(
  (SELECT id FROM public.registrations LIMIT 1),
  (SELECT firebase_uid FROM public.registrations LIMIT 1)
);
-- Should return true
