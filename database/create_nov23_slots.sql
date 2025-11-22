-- ============================================
-- Create Sunday Practice Slots for November 23, 2025
-- ============================================
-- This creates the missing slots for this Sunday

-- Slot 1: 7:30 AM - 8:30 AM (M7-M11)
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

-- Slot 2: 8:30 AM - 9:30 AM (M13-M15)
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

-- Verify slots were created
SELECT
  practice_date,
  TO_CHAR(start_time, 'HH12:MI AM') || ' - ' || TO_CHAR(end_time, 'HH12:MI AM') as time,
  min_category || '-' || max_category as ages,
  current_bookings || '/' || max_capacity as spots
FROM sunday_practice_slots
WHERE practice_date = '2025-11-23'
ORDER BY start_time;
