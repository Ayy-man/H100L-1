-- ============================================================
-- Fix Sunday Practice Schema Constraints for M7-M15 Eligibility
-- ============================================================
-- The current schema only allows M11+ in the CHECK constraints
-- This fixes it to allow M7, M9, M11, M13, M15 as per business requirements

-- Drop the existing constraint
ALTER TABLE public.sunday_practice_slots
  DROP CONSTRAINT IF EXISTS sunday_practice_slots_min_category_check;

ALTER TABLE public.sunday_practice_slots
  DROP CONSTRAINT IF EXISTS sunday_practice_slots_max_category_check;

ALTER TABLE public.sunday_practice_slots
  DROP CONSTRAINT IF EXISTS valid_category_range;

-- Add new constraints that allow M7 and M9
ALTER TABLE public.sunday_practice_slots
  ADD CONSTRAINT sunday_practice_slots_min_category_check
  CHECK (min_category IN ('M7', 'M9', 'M11', 'M13', 'M15'));

ALTER TABLE public.sunday_practice_slots
  ADD CONSTRAINT sunday_practice_slots_max_category_check
  CHECK (max_category IN ('M7', 'M9', 'M11', 'M13', 'M13 Elite', 'M15', 'M15 Elite'));

-- Add constraint for valid category ranges
-- Slot 1: M7 to M11 (includes M7, M9, M11)
-- Slot 2: M13 to M15 (includes M13, M15)
ALTER TABLE public.sunday_practice_slots
  ADD CONSTRAINT valid_category_range CHECK (
    (min_category = 'M7' AND max_category IN ('M11')) OR
    (min_category = 'M11' AND max_category IN ('M13', 'M13 Elite')) OR
    (min_category = 'M13' AND max_category IN ('M15', 'M15 Elite'))
  );

-- Update comment
COMMENT ON TABLE public.sunday_practice_slots IS 'Weekly Sunday ice practice time slots with capacity management - Eligible for M7-M15 Group Training players';

-- Verify the constraints
SELECT
  constraint_name,
  check_clause
FROM information_schema.check_constraints
WHERE constraint_schema = 'public'
  AND constraint_name LIKE '%sunday_practice_slots%'
ORDER BY constraint_name;
