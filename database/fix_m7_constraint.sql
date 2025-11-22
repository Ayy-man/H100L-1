-- ============================================
-- Fix: Drop old constraint and allow M7-M11 slots
-- ============================================
-- The old constraint only allowed M11 or M13 as min_category
-- This prevented M7-M11 slots from working correctly

-- Step 1: Drop the old restrictive constraint
ALTER TABLE sunday_practice_slots
DROP CONSTRAINT IF EXISTS valid_category_range;

-- Step 2: Add a new, more flexible constraint
ALTER TABLE sunday_practice_slots
ADD CONSTRAINT valid_category_range CHECK (
  (min_category = 'M7' AND max_category IN ('M9', 'M11', 'M13', 'M13 Elite')) OR
  (min_category = 'M9' AND max_category IN ('M11', 'M13', 'M13 Elite')) OR
  (min_category = 'M11' AND max_category IN ('M13', 'M13 Elite')) OR
  (min_category = 'M13' AND max_category IN ('M15', 'M15 Elite', 'M18', 'Junior'))
);

-- Step 3: Update existing Nov 23 slots to ensure they're correct
UPDATE sunday_practice_slots
SET
  min_category = 'M7',
  max_category = 'M11',
  max_capacity = 12
WHERE practice_date = '2025-11-23'
  AND start_time = '07:30:00'::TIME;

UPDATE sunday_practice_slots
SET
  min_category = 'M13',
  max_category = 'M15',
  max_capacity = 10
WHERE practice_date = '2025-11-23'
  AND start_time = '08:30:00'::TIME;

-- Step 4: Verify the slots
SELECT
  practice_date,
  TO_CHAR(start_time, 'HH12:MI AM') || ' - ' || TO_CHAR(end_time, 'HH12:MI AM') as time,
  min_category || '-' || max_category as ages,
  max_capacity as capacity,
  is_active
FROM sunday_practice_slots
WHERE practice_date = '2025-11-23'
ORDER BY start_time;

-- Step 5: Test eligibility for different categories
SELECT
  'M11 player can book M7-M11 slot:' as test,
  CASE
    WHEN 11 >= extract_category_number('M7')
     AND 11 <= extract_category_number('M11')
    THEN 'YES ✓'
    ELSE 'NO ✗'
  END as result
UNION ALL
SELECT
  'M13 player can book M13-M15 slot:',
  CASE
    WHEN 13 >= extract_category_number('M13')
     AND 13 <= extract_category_number('M15')
    THEN 'YES ✓'
    ELSE 'NO ✗'
  END;

-- Success message
DO $$
BEGIN
  RAISE NOTICE '✅ Constraint fixed! M7-M11 slots now allowed.';
  RAISE NOTICE 'Slots updated for November 23, 2025';
END $$;
