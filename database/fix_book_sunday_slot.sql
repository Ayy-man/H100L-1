-- ============================================================
-- Fix book_sunday_slot Function
-- ============================================================
-- Fixes:
-- 1. Ambiguous 'id' reference (should be b.id)
-- 2. Payment status to accept 'verified' and 'paid'
-- 3. Category eligibility to M11-M15 only (not M18)

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
  v_player_category_num INTEGER;
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

  -- 6. FIXED: Validate payment status (accept verified and paid)
  IF v_payment_status NOT IN ('succeeded', 'verified', 'paid') THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Active subscription required to book Sunday practice',
      'code', 'PAYMENT_REQUIRED'
    );
  END IF;

  -- 7. FIXED: Validate player category eligibility (M11-M15 only, not M18)
  v_player_category_num := extract_category_number(v_player_category);
  
  IF v_player_category_num < 11 OR v_player_category_num > 15 THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Only M11-M15 players can book Sunday practice',
      'code', 'INELIGIBLE_CATEGORY'
    );
  END IF;

  -- 8. FIXED: Check if player already has a booking (b.id instead of ambiguous id)
  SELECT b.id INTO v_existing_booking
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
    'message', 'Sunday practice booked successfully!'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.book_sunday_slot TO anon, authenticated;

-- Success message
DO $$
BEGIN
  RAISE NOTICE '✅ book_sunday_slot function fixed!';
  RAISE NOTICE '  - Fixed ambiguous id reference (now b.id)';
  RAISE NOTICE '  - Accepts verified and paid payment statuses';
  RAISE NOTICE '  - Restricted to M11-M15 only (M18 excluded)';
END $$;
