-- ============================================
-- COMPLETE SUNDAY PRACTICE FIX
-- ============================================
-- Run this entire file in Supabase SQL Editor to fix:
-- 1. Missing slots for November 23, 2025
-- 2. Category comparison bug (text vs numeric)
-- 3. Payment status acceptance ('verified' status)

-- ============================================
-- PART 1: Helper Function for Numeric Comparison
-- ============================================

-- Extract numeric value from category strings
CREATE OR REPLACE FUNCTION extract_category_number(category TEXT)
RETURNS INTEGER AS $$
BEGIN
  -- M7 → 7, M11 → 11, M13 → 13, etc.
  -- 'M13 Elite' → 13
  -- 'Junior' → 99 (highest)

  IF category = 'Junior' THEN
    RETURN 99;
  END IF;

  -- Extract number after 'M' using regex
  RETURN CAST(SUBSTRING(category FROM 'M([0-9]+)') AS INTEGER);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

GRANT EXECUTE ON FUNCTION extract_category_number TO anon, authenticated;

-- ============================================
-- PART 2: Fix get_next_sunday_slot Function
-- ============================================

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

  -- 2. Validate eligibility - Group Training only
  IF v_program_type != 'group' THEN
    RETURN json_build_object(
      'success', true,
      'eligible', false,
      'reason', 'Only Group Training players can book Sunday practice'
    );
  END IF;

  -- Extract numeric category for proper comparison
  v_player_category_num := extract_category_number(v_player_category);

  -- Check if category is M11+ (numeric value >= 11)
  IF v_player_category_num < 11 AND v_player_category != 'Junior' THEN
    RETURN json_build_object(
      'success', true,
      'eligible', false,
      'reason', 'Only M11+ players can book Sunday practice'
    );
  END IF;

  -- FIXED: Accept succeeded, verified, and paid payment statuses
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

  -- 5. Get available slots with NUMERIC category comparison
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
      -- FIXED: Use numeric comparison (11 >= 7, not 'M11' >= 'M7')
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

COMMENT ON FUNCTION public.get_next_sunday_slot IS 'Returns next Sunday slots with NUMERIC category comparison and verified payment support';

GRANT EXECUTE ON FUNCTION public.get_next_sunday_slot TO anon, authenticated;

-- ============================================
-- PART 3: Create Missing Slots for Nov 23
-- ============================================

-- Slot 1: 7:30-8:30 AM (M7-M11) - 12 kids
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
  '2025-11-23'::DATE,
  '07:30:00'::TIME,
  '08:30:00'::TIME,
  'M7',
  'M11',
  12,
  0,
  true
)
ON CONFLICT (practice_date, start_time) DO NOTHING;

-- Slot 2: 8:30-9:30 AM (M13-M15) - 10 kids
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
  '2025-11-23'::DATE,
  '08:30:00'::TIME,
  '09:30:00'::TIME,
  'M13',
  'M15',
  10,
  0,
  true
)
ON CONFLICT (practice_date, start_time) DO NOTHING;

-- ============================================
-- VERIFICATION: Check All Fixes
-- ============================================

-- Show all upcoming Sunday slots
SELECT
  practice_date,
  TO_CHAR(start_time, 'HH12:MI AM') || ' - ' || TO_CHAR(end_time, 'HH12:MI AM') as time,
  min_category || '-' || max_category as ages,
  current_bookings || '/' || max_capacity as spots,
  is_active
FROM sunday_practice_slots
WHERE practice_date >= CURRENT_DATE
ORDER BY practice_date, start_time;

-- Test the numeric comparison function
SELECT
  'M7' as category,
  extract_category_number('M7') as num
UNION ALL
SELECT 'M11', extract_category_number('M11')
UNION ALL
SELECT 'M13', extract_category_number('M13')
UNION ALL
SELECT 'Junior', extract_category_number('Junior');

-- Show which categories can book which slots (for Nov 23)
SELECT
  s.practice_date,
  s.min_category || '-' || s.max_category as slot_range,
  'M11 can book: ' || CASE
    WHEN 11 >= extract_category_number(s.min_category)
     AND 11 <= extract_category_number(s.max_category)
    THEN 'YES ✓'
    ELSE 'NO ✗'
  END as m11_eligible,
  'M13 can book: ' || CASE
    WHEN 13 >= extract_category_number(s.min_category)
     AND 13 <= extract_category_number(s.max_category)
    THEN 'YES ✓'
    ELSE 'NO ✗'
  END as m13_eligible
FROM sunday_practice_slots s
WHERE s.practice_date = '2025-11-23'
ORDER BY s.start_time;

-- Success message
DO $$
BEGIN
  RAISE NOTICE '✅ ALL FIXES APPLIED SUCCESSFULLY!';
  RAISE NOTICE '1. Created slots for November 23, 2025';
  RAISE NOTICE '2. Fixed category comparison (now uses numbers)';
  RAISE NOTICE '3. Added support for verified payment status';
  RAISE NOTICE '';
  RAISE NOTICE 'Next step: Reload your dashboard to see available slots!';
END $$;
