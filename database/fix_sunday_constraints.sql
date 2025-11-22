-- Fix Sunday Practice Slots for M7-M9-M11 Support
-- Run this to update the existing table constraints

-- Drop the old check constraints
ALTER TABLE sunday_practice_slots
DROP CONSTRAINT IF EXISTS sunday_practice_slots_min_category_check,
DROP CONSTRAINT IF EXISTS sunday_practice_slots_max_category_check;

-- Add new check constraints that include M7 and M9
ALTER TABLE sunday_practice_slots
ADD CONSTRAINT sunday_practice_slots_min_category_check
  CHECK (min_category = ANY (ARRAY['M7'::text, 'M9'::text, 'M11'::text, 'M13'::text, 'M15'::text, 'M18'::text]));

ALTER TABLE sunday_practice_slots
ADD CONSTRAINT sunday_practice_slots_max_category_check
  CHECK (max_category = ANY (ARRAY['M7'::text, 'M9'::text, 'M11'::text, 'M13'::text, 'M15'::text, 'M18'::text, 'M13 Elite'::text, 'M15 Elite'::text, 'Junior'::text]));

-- Update existing slots to match new configuration
-- Slot 1: 7:30-8:30 AM (M7-M9-M11) - 12 kids
UPDATE sunday_practice_slots
SET
  max_capacity = 12,
  min_category = 'M7',
  max_category = 'M11'
WHERE
  start_time = '07:30:00'
  AND end_time = '08:30:00';

-- Slot 2: 8:30-9:30 AM (M13-M15) - 10 kids
UPDATE sunday_practice_slots
SET
  max_capacity = 10,
  min_category = 'M13',
  max_category = 'M15'
WHERE
  start_time = '08:30:00'
  AND end_time = '09:30:00';

-- Delete any other time slots that don't match
DELETE FROM sunday_practice_slots
WHERE
  NOT (
    (start_time = '07:30:00' AND end_time = '08:30:00')
    OR
    (start_time = '08:30:00' AND end_time = '09:30:00')
  );

-- Verify the changes
SELECT
  practice_date,
  start_time,
  end_time,
  min_category,
  max_category,
  max_capacity,
  current_bookings,
  available_spots
FROM sunday_practice_slots
ORDER BY practice_date, start_time;
