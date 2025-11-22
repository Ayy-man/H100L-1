-- ============================================
-- Fix Sunday Practice Category Comparison
-- ============================================
-- The current function uses TEXT comparison which doesn't work:
-- 'M11' >= 'M7' = FALSE (because '1' < '7')
--
-- This fixes it by extracting numbers and comparing numerically

-- Helper function to extract numeric value from category
CREATE OR REPLACE FUNCTION extract_category_number(category TEXT)
RETURNS INTEGER AS $$
BEGIN
  -- Extract number from M7, M11, M13, etc.
  -- For 'M13 Elite' or 'M15 Elite', extract the number before 'Elite'
  -- For 'Junior', return a high number (99)

  IF category = 'Junior' THEN
    RETURN 99;
  END IF;

  -- Use regex to extract the number after 'M'
  RETURN CAST(SUBSTRING(category FROM 'M([0-9]+)') AS INTEGER);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Updated get_next_sunday_slot with proper category comparison
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

  -- Check if category is M11+ (numeric value >= 11)
  IF v_player_category_num < 11 AND v_player_category != 'Junior' THEN
    RETURN json_build_object(
      'success', true,
      'eligible', false,
      'reason', 'Only M11+ players can book Sunday practice'
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
    AND (
      -- FIXED: Use numeric comparison instead of text
      v_player_category_num >= extract_category_number(min_category)
      AND v_player_category_num <= extract_category_number(max_category)
    );

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

-- Update comment
COMMENT ON FUNCTION public.get_next_sunday_slot IS 'Returns next Sunday slot availability. Uses NUMERIC category comparison (M7=7, M11=11, etc)';

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.get_next_sunday_slot TO anon, authenticated;
GRANT EXECUTE ON FUNCTION extract_category_number TO anon, authenticated;
