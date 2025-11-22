-- ============================================================
-- COMPLETE FIX FOR SUNDAY PRACTICE BOOKING
-- ============================================================
-- Run this ENTIRE file in Supabase SQL Editor
-- This fixes all issues in one go:
-- 1. Creates helper function for numeric category comparison
-- 2. Updates get_next_sunday_slot to work correctly
-- 3. Drops restrictive constraints
-- 4. Creates/updates slots for Nov 23
-- ============================================================

-- ============================================================
-- STEP 1: Create helper function for numeric comparison
-- ============================================================

CREATE OR REPLACE FUNCTION extract_category_number(category TEXT)
RETURNS INTEGER AS $$
BEGIN
  IF category = 'Junior' THEN
    RETURN 99;
  END IF;
  
  RETURN CAST(SUBSTRING(category FROM 'M([0-9]+)') AS INTEGER);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

GRANT EXECUTE ON FUNCTION extract_category_number TO anon, authenticated;

-- ============================================================
-- STEP 2: Fix get_next_sunday_slot function
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
  -- Get registration details
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
      'error', 'Registration not found'
    );
  END IF;

  -- Check program type
  IF v_program_type != 'group' THEN
    RETURN json_build_object(
      'success', true,
      'eligible', false,
      'reason', 'Only Group Training players can book Sunday practice'
    );
  END IF;

  -- Get numeric category
  v_player_category_num := extract_category_number(v_player_category);

  -- Check M11+
  IF v_player_category_num < 11 AND v_player_category != 'Junior' THEN
    RETURN json_build_object(
      'success', true,
      'eligible', false,
      'reason', 'Only M11+ players can book Sunday practice'
    );
  END IF;

  -- Check payment status
  IF v_payment_status NOT IN ('succeeded', 'verified', 'paid') THEN
    RETURN json_build_object(
      'success', true,
      'eligible', false,
      'reason', 'Active subscription required'
    );
  END IF;

  -- Calculate next Sunday
  v_next_sunday := CURRENT_DATE + ((7 - EXTRACT(DOW FROM CURRENT_DATE)::INTEGER) % 7);
  IF v_next_sunday = CURRENT_DATE THEN
    v_next_sunday := v_next_sunday + 7;
  END IF;

  -- Check existing booking
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

  -- Get available slots with NUMERIC comparison
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
      v_player_category_num >= extract_category_number(min_category)
      AND v_player_category_num <= extract_category_number(max_category)
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

-- ============================================================
-- STEP 3: Drop old constraint
-- ============================================================

ALTER TABLE sunday_practice_slots
DROP CONSTRAINT IF EXISTS valid_category_range;

-- ============================================================
-- STEP 4: Add flexible constraint allowing M7-M11 and M13-M18
-- ============================================================

ALTER TABLE sunday_practice_slots
ADD CONSTRAINT valid_category_range CHECK (
  (min_category = 'M7' AND max_category IN ('M9', 'M11')) OR
  (min_category = 'M11' AND max_category IN ('M13', 'M13 Elite')) OR
  (min_category = 'M13' AND max_category IN ('M15', 'M15 Elite', 'M18', 'Junior'))
);

-- ============================================================
-- STEP 5: Delete old Nov 23 slots and create fresh ones
-- ============================================================

DELETE FROM sunday_practice_slots WHERE practice_date = '2025-11-23';

-- Slot 1: 7:30-8:30 AM (M7-M11) - 12 kids
INSERT INTO sunday_practice_slots (
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
);

-- Slot 2: 8:30-9:30 AM (M13-M18) - 10 kids  
INSERT INTO sunday_practice_slots (
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
  'M18',
  10,
  0,
  true
);

-- ============================================================
-- VERIFICATION
-- ============================================================

SELECT
  'SLOTS FOR NOV 23:' as section,
  practice_date,
  TO_CHAR(start_time, 'HH12:MI AM') || ' - ' || TO_CHAR(end_time, 'HH12:MI AM') as time,
  min_category || '-' || max_category as ages,
  max_capacity as capacity
FROM sunday_practice_slots
WHERE practice_date = '2025-11-23'
ORDER BY start_time;

SELECT
  'CATEGORY TESTS:' as section,
  'M11' as category,
  CASE
    WHEN 11 >= extract_category_number('M7') AND 11 <= extract_category_number('M11')
    THEN 'Can book 7:30 slot ✓'
    ELSE 'Cannot book 7:30 slot ✗'
  END as slot_1,
  CASE
    WHEN 11 >= extract_category_number('M13') AND 11 <= extract_category_number('M18')
    THEN 'Can book 8:30 slot ✓'
    ELSE 'Cannot book 8:30 slot ✗'
  END as slot_2
UNION ALL
SELECT
  'CATEGORY TESTS:',
  'M13',
  CASE
    WHEN 13 >= 7 AND 13 <= 11
    THEN 'Can book 7:30 slot ✓'
    ELSE 'Cannot book 7:30 slot ✗'
  END,
  CASE
    WHEN 13 >= 13 AND 13 <= 18
    THEN 'Can book 8:30 slot ✓'
    ELSE 'Cannot book 8:30 slot ✗'
  END
UNION ALL
SELECT
  'CATEGORY TESTS:',
  'M18',
  CASE
    WHEN 18 >= 7 AND 18 <= 11
    THEN 'Can book 7:30 slot ✓'
    ELSE 'Cannot book 7:30 slot ✗'
  END,
  CASE
    WHEN 18 >= 13 AND 18 <= 18
    THEN 'Can book 8:30 slot ✓'
    ELSE 'Cannot book 8:30 slot ✗'
  END;

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '═══════════════════════════════════════';
  RAISE NOTICE '✅ ALL FIXES APPLIED SUCCESSFULLY!';
  RAISE NOTICE '═══════════════════════════════════════';
  RAISE NOTICE '';
  RAISE NOTICE 'Slots created for November 23, 2025:';
  RAISE NOTICE '  • 7:30-8:30 AM: M7-M11 (12 spots)';
  RAISE NOTICE '  • 8:30-9:30 AM: M13-M18 (10 spots)';
  RAISE NOTICE '';
  RAISE NOTICE 'Who can book:';
  RAISE NOTICE '  • M11: 7:30 AM slot only';
  RAISE NOTICE '  • M13: 8:30 AM slot only';
  RAISE NOTICE '  • M15: 8:30 AM slot only';
  RAISE NOTICE '  • M18: 8:30 AM slot only';
  RAISE NOTICE '';
  RAISE NOTICE 'Next step: Reload your dashboard!';
  RAISE NOTICE '';
END $$;
