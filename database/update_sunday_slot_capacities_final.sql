-- ============================================================
-- Update Sunday Practice Slot Capacities to Match Business Requirements
-- ============================================================
-- Early Slot (7:30-8:30 AM) for M7, M9, M11: 12 kids max
-- Late Slot (8:30-9:30 AM) for M13, M15: 10 kids max

-- Update early slot capacity and category range
UPDATE public.sunday_practice_slots
SET
  max_capacity = 12,
  min_category = 'M7',
  max_category = 'M11',
  updated_at = NOW()
WHERE
  start_time = '07:30:00'
  AND end_time = '08:30:00';

-- Update late slot capacity and category range
UPDATE public.sunday_practice_slots
SET
  max_capacity = 10,
  min_category = 'M13',
  max_category = 'M15',
  updated_at = NOW()
WHERE
  start_time = '08:30:00'
  AND end_time = '09:30:00';

-- Update the generate_sunday_slots function to use correct capacities
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

    -- Create Slot 1: 7:30-8:30 AM for M7-M11 (12 kids max)
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
      'M7',
      'M11',
      12,  -- 12 kids for early slot
      0,
      true
    )
    RETURNING id INTO v_slot_id;

    v_slots_created := v_slots_created + 1;

    -- Create Slot 2: 8:30-9:30 AM for M13-M15 (10 kids max)
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
      'M15',
      10,  -- 10 kids for late slot
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

COMMENT ON FUNCTION public.generate_sunday_slots IS 'Auto-generates Sunday practice slots for upcoming weeks with correct capacities (12 for early, 10 for late)';

-- Verify the changes
SELECT
  practice_date,
  TO_CHAR(start_time, 'HH12:MI AM') || ' - ' || TO_CHAR(end_time, 'HH12:MI AM') as time_range,
  min_category || ' - ' || max_category as age_group,
  max_capacity,
  current_bookings,
  available_spots,
  CASE
    WHEN start_time = '07:30:00' THEN '✓ Early slot (should be 12)'
    WHEN start_time = '08:30:00' THEN '✓ Late slot (should be 10)'
    ELSE '⚠️ Unknown slot'
  END as validation
FROM public.sunday_practice_slots
ORDER BY practice_date, start_time;
