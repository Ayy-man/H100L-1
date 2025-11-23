-- ============================================================
-- Add Sunday Slots for November 23 onwards
-- ============================================================
-- Creates slots for the next 4 Sundays so users can always
-- book the upcoming Sunday starting from Sunday 00:00

-- Clear old slots first
DELETE FROM sunday_practice_slots WHERE practice_date >= '2025-11-23';

-- Insert slots for next 4 Sundays
INSERT INTO sunday_practice_slots (
  practice_date, start_time, end_time,
  min_category, max_category,
  max_capacity, current_bookings, is_active
) VALUES
  -- November 23
  ('2025-11-23', '07:30:00', '08:30:00', 'M7', 'M11', 12, 0, true),
  ('2025-11-23', '08:30:00', '09:30:00', 'M13', 'M15', 10, 0, true),
  
  -- November 30
  ('2025-11-30', '07:30:00', '08:30:00', 'M7', 'M11', 12, 0, true),
  ('2025-11-30', '08:30:00', '09:30:00', 'M13', 'M15', 10, 0, true),
  
  -- December 7
  ('2025-12-07', '07:30:00', '08:30:00', 'M7', 'M11', 12, 0, true),
  ('2025-12-07', '08:30:00', '09:30:00', 'M13', 'M15', 10, 0, true),
  
  -- December 14
  ('2025-12-14', '07:30:00', '08:30:00', 'M7', 'M11', 12, 0, true),
  ('2025-12-14', '08:30:00', '09:30:00', 'M13', 'M15', 10, 0, true);

-- Verify
SELECT
  practice_date,
  TO_CHAR(start_time, 'HH12:MI AM') || ' - ' || TO_CHAR(end_time, 'HH12:MI AM') as time,
  min_category || '-' || max_category as ages,
  max_capacity as capacity,
  current_bookings || '/' || max_capacity as booked
FROM sunday_practice_slots
WHERE practice_date >= CURRENT_DATE
ORDER BY practice_date, start_time;

DO $$
BEGIN
  RAISE NOTICE '✅ Created slots for 4 Sundays!';
  RAISE NOTICE 'Users on Sunday can now book for next Sunday (7 days ahead)';
END $$;
