-- ============================================================
-- FIX SUNDAY SLOTS GENERATION
-- ============================================================
-- Run this file in Supabase SQL Editor to:
-- 1. Fix generate_sunday_slots function with correct category ranges
-- 2. Generate slots for the next 4 upcoming Sundays
-- ============================================================

-- PART 1: Fix the generate_sunday_slots function
CREATE OR REPLACE FUNCTION public.generate_sunday_slots(
  p_weeks_ahead INTEGER DEFAULT 4
)
RETURNS JSON AS $$
DECLARE
  v_sunday DATE;
  v_week INTEGER;
  v_slots_created INTEGER := 0;
  v_slot_id UUID;
BEGIN
  -- Loop through weeks ahead
  FOR v_week IN 0..(p_weeks_ahead - 1) LOOP
    -- Calculate Sunday date (start from next Sunday if today is not Sunday)
    IF EXTRACT(DOW FROM CURRENT_DATE) = 0 THEN
      -- Today is Sunday
      v_sunday := CURRENT_DATE + (7 * v_week);
    ELSE
      -- Calculate next Sunday
      v_sunday := CURRENT_DATE + (7 - EXTRACT(DOW FROM CURRENT_DATE)::INTEGER) + (7 * v_week);
    END IF;

    -- Check if slots already exist for this Sunday
    IF EXISTS (
      SELECT 1 FROM public.sunday_practice_slots WHERE practice_date = v_sunday
    ) THEN
      CONTINUE;
    END IF;

    -- Create Slot 1: 7:30-8:30 AM for M7, M9, M11 (capacity 12)
    INSERT INTO public.sunday_practice_slots (
      practice_date,
      start_time,
      end_time,
      min_category,
      max_category,
      max_capacity,
      current_bookings,
      available_spots,
      is_active
    ) VALUES (
      v_sunday,
      '07:30:00'::TIME,
      '08:30:00'::TIME,
      'M7',           -- FIXED: was M11
      'M11',          -- FIXED: was M13 Elite
      12,             -- 12 kids max
      0,
      12,
      true
    )
    RETURNING id INTO v_slot_id;

    v_slots_created := v_slots_created + 1;

    -- Create Slot 2: 8:30-9:30 AM for M13, M13 Elite, M15, M15 Elite (capacity 10)
    INSERT INTO public.sunday_practice_slots (
      practice_date,
      start_time,
      end_time,
      min_category,
      max_category,
      max_capacity,
      current_bookings,
      available_spots,
      is_active
    ) VALUES (
      v_sunday,
      '08:30:00'::TIME,
      '09:30:00'::TIME,
      'M13',          -- FIXED
      'M15 Elite',    -- FIXED: was Junior
      10,             -- 10 kids max
      0,
      10,
      true
    )
    RETURNING id INTO v_slot_id;

    v_slots_created := v_slots_created + 1;
  END LOOP;

  -- Return result
  RETURN json_build_object(
    'success', true,
    'slots_created', v_slots_created,
    'message', 'Generated ' || v_slots_created || ' slots for ' || p_weeks_ahead || ' weeks'
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

GRANT EXECUTE ON FUNCTION public.generate_sunday_slots TO authenticated;

-- PART 2: Generate slots for the next 4 Sundays immediately
SELECT public.generate_sunday_slots(4);

-- PART 3: Verify slots were created
SELECT
  practice_date,
  TO_CHAR(start_time, 'HH12:MI AM') || ' - ' || TO_CHAR(end_time, 'HH12:MI AM') as time_slot,
  min_category || ' to ' || max_category as category_range,
  available_spots || '/' || max_capacity as capacity,
  is_active
FROM public.sunday_practice_slots
WHERE practice_date >= CURRENT_DATE
ORDER BY practice_date, start_time;

SELECT 'Sunday slots generation complete!' as status;
