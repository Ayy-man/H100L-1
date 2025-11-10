-- ============================================
-- CAPACITY MANAGEMENT SETUP
-- ============================================
-- Sets up time slots with capacity tracking and automatic registration counting

-- ============================================
-- 1. ADD UNIQUE CONSTRAINT ON TIME_SLOT_NAME
-- ============================================
-- This allows ON CONFLICT to work properly
ALTER TABLE public.time_slots
ADD CONSTRAINT time_slots_name_unique UNIQUE (time_slot_name);

-- ============================================
-- 2. CLEAR EXISTING DATA (OPTIONAL - UNCOMMENT IF NEEDED)
-- ============================================
-- TRUNCATE TABLE public.time_slots CASCADE;

-- ============================================
-- 3. INSERT TIME SLOTS FOR TUESDAY & FRIDAY
-- ============================================

-- Tuesday Slots
INSERT INTO public.time_slots (time_slot_name, day_of_week, applicable_categories, capacity, current_registrations, is_active)
VALUES
  ('Tuesday 4:30-5:30 PM', 'Tuesday', ARRAY['M9', 'M11'], 6, 0, true),
  ('Tuesday 5:45-6:45 PM', 'Tuesday', ARRAY['M9', 'M11', 'M13'], 6, 0, true),
  ('Tuesday 7:00-8:00 PM', 'Tuesday', ARRAY['M13', 'M15'], 6, 0, true),
  ('Tuesday 8:15-9:15 PM', 'Tuesday', ARRAY['M15', 'M18'], 6, 0, true)
ON CONFLICT (time_slot_name) DO NOTHING;

-- Friday Slots
INSERT INTO public.time_slots (time_slot_name, day_of_week, applicable_categories, capacity, current_registrations, is_active)
VALUES
  ('Friday 4:30-5:30 PM', 'Friday', ARRAY['M9', 'M11'], 6, 0, true),
  ('Friday 5:45-6:45 PM', 'Friday', ARRAY['M9', 'M11', 'M13'], 6, 0, true),
  ('Friday 7:00-8:00 PM', 'Friday', ARRAY['M13', 'M15'], 6, 0, true),
  ('Friday 8:15-9:15 PM', 'Friday', ARRAY['M15', 'M18'], 6, 0, true)
ON CONFLICT (time_slot_name) DO NOTHING;

-- ============================================
-- 4. CREATE FUNCTION TO CALCULATE CURRENT REGISTRATIONS
-- ============================================

-- Drop existing function if it exists
DROP FUNCTION IF EXISTS public.calculate_slot_registrations();

-- Create function to count registrations per time slot
CREATE OR REPLACE FUNCTION public.calculate_slot_registrations()
RETURNS TABLE (
  slot_name text,
  registration_count bigint,
  registered_players jsonb
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    ts.time_slot_name::text,
    COUNT(r.id)::bigint as registration_count,
    jsonb_agg(
      jsonb_build_object(
        'id', r.id,
        'player_name', r.form_data->>'playerFullName',
        'player_category', r.form_data->>'playerCategory',
        'parent_email', r.form_data->>'parentEmail',
        'created_at', r.created_at
      )
      ORDER BY r.created_at DESC
    ) FILTER (WHERE r.id IS NOT NULL) as registered_players
  FROM public.time_slots ts
  LEFT JOIN public.registrations r ON (
    -- Match group training on Tuesday (1x per week)
    (r.form_data->>'programType' = 'group'
     AND r.form_data->>'groupFrequency' = '1x'
     AND r.form_data->>'groupDay' = LOWER(ts.day_of_week)
     AND (r.form_data->>'playerCategory') = ANY(ts.applicable_categories))
    OR
    -- Match group training on both days (2x per week)
    (r.form_data->>'programType' = 'group'
     AND r.form_data->>'groupFrequency' = '2x'
     AND (r.form_data->>'playerCategory') = ANY(ts.applicable_categories))
  )
  WHERE ts.is_active = true
  GROUP BY ts.id, ts.time_slot_name, ts.day_of_week
  ORDER BY ts.day_of_week, ts.time_slot_name;
END;
$$;

-- Add comment
COMMENT ON FUNCTION public.calculate_slot_registrations() IS 'Calculates current registrations for each time slot and returns player details';

-- ============================================
-- 5. CREATE FUNCTION TO UPDATE SLOT COUNTS
-- ============================================

-- Drop existing function
DROP FUNCTION IF EXISTS public.update_time_slot_counts();

-- Create function to update current_registrations field
CREATE OR REPLACE FUNCTION public.update_time_slot_counts()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  -- Update each time slot's current_registrations count
  UPDATE public.time_slots ts
  SET current_registrations = COALESCE(counts.count, 0)
  FROM (
    SELECT
      ts.id,
      COUNT(r.id) as count
    FROM public.time_slots ts
    LEFT JOIN public.registrations r ON (
      -- Match group training on specific day (1x per week)
      (r.form_data->>'programType' = 'group'
       AND r.form_data->>'groupFrequency' = '1x'
       AND r.form_data->>'groupDay' = LOWER(ts.day_of_week)
       AND (r.form_data->>'playerCategory') = ANY(ts.applicable_categories))
      OR
      -- Match group training on both days (2x per week)
      (r.form_data->>'programType' = 'group'
       AND r.form_data->>'groupFrequency' = '2x'
       AND (r.form_data->>'playerCategory') = ANY(ts.applicable_categories))
    )
    WHERE ts.is_active = true
    GROUP BY ts.id
  ) counts
  WHERE ts.id = counts.id;
END;
$$;

-- Add comment
COMMENT ON FUNCTION public.update_time_slot_counts() IS 'Updates the current_registrations field for all active time slots';

-- ============================================
-- 6. CREATE TRIGGER TO AUTO-UPDATE COUNTS
-- ============================================

-- Drop existing trigger and function
DROP TRIGGER IF EXISTS trigger_update_slot_counts ON public.registrations;
DROP FUNCTION IF EXISTS public.trigger_update_slot_counts();

-- Create trigger function
CREATE OR REPLACE FUNCTION public.trigger_update_slot_counts()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- Update slot counts whenever a registration is inserted, updated, or deleted
  PERFORM public.update_time_slot_counts();
  RETURN NEW;
END;
$$;

-- Create trigger on registrations table
CREATE TRIGGER trigger_update_slot_counts
AFTER INSERT OR UPDATE OR DELETE ON public.registrations
FOR EACH STATEMENT
EXECUTE FUNCTION public.trigger_update_slot_counts();

-- Add comment
COMMENT ON TRIGGER trigger_update_slot_counts ON public.registrations IS 'Automatically updates time slot counts when registrations change';

-- ============================================
-- 7. CREATE VIEW FOR CAPACITY OVERVIEW
-- ============================================

DROP VIEW IF EXISTS public.capacity_overview;

CREATE OR REPLACE VIEW public.capacity_overview AS
SELECT
  ts.id,
  ts.time_slot_name,
  ts.day_of_week,
  ts.applicable_categories,
  ts.capacity,
  ts.current_registrations,
  ts.is_active,
  CASE
    WHEN ts.current_registrations >= ts.capacity THEN 'FULL'
    WHEN ts.current_registrations >= (ts.capacity * 0.75) THEN 'ALMOST_FULL'
    WHEN ts.current_registrations >= (ts.capacity * 0.5) THEN 'HALF_FULL'
    ELSE 'AVAILABLE'
  END as status,
  ROUND((ts.current_registrations::decimal / ts.capacity::decimal) * 100, 0) as fill_percentage,
  (ts.capacity - ts.current_registrations) as spots_remaining
FROM public.time_slots ts
WHERE ts.is_active = true
ORDER BY
  CASE ts.day_of_week
    WHEN 'Tuesday' THEN 1
    WHEN 'Friday' THEN 2
    ELSE 3
  END,
  ts.time_slot_name;

-- Add comment
COMMENT ON VIEW public.capacity_overview IS 'Provides an overview of capacity status for all active time slots';

-- Grant permissions
GRANT SELECT ON public.capacity_overview TO anon, authenticated;

-- ============================================
-- 8. INITIAL COUNT UPDATE
-- ============================================

-- Run the update function to set initial counts
SELECT public.update_time_slot_counts();

-- ============================================
-- 9. VERIFICATION QUERIES
-- ============================================

-- Check time slots
SELECT
  id,
  time_slot_name,
  day_of_week,
  applicable_categories,
  capacity,
  current_registrations,
  is_active
FROM public.time_slots
ORDER BY day_of_week, time_slot_name;

-- Check capacity overview
SELECT * FROM public.capacity_overview;

-- Test the calculation function
SELECT * FROM public.calculate_slot_registrations();

-- Check triggers
SELECT
  trigger_name,
  event_manipulation,
  event_object_table,
  action_statement
FROM information_schema.triggers
WHERE trigger_name = 'trigger_update_slot_counts';

-- ============================================
-- 10. MANUAL UPDATE COMMAND (if needed)
-- ============================================

-- Run this manually if you need to recalculate all slot counts:
-- SELECT public.update_time_slot_counts();
