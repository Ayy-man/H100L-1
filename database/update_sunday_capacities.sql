-- Update Sunday Practice Slot Capacities
-- Run this after the main migration to set correct capacities

-- Update 7:30-8:30 AM slot (M7-M9-M11) to 12 kids
UPDATE sunday_practice_slots
SET
  max_capacity = 12,
  min_category = 'M7',
  max_category = 'M11'
WHERE
  start_time = '07:30:00'
  AND end_time = '08:30:00';

-- Update 8:30-9:30 AM slot (M13-M15) to 10 kids
UPDATE sunday_practice_slots
SET
  max_capacity = 10,
  min_category = 'M13',
  max_category = 'M15'
WHERE
  start_time = '08:30:00'
  AND end_time = '09:30:00';

-- Delete any other time slots that don't match these two
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
