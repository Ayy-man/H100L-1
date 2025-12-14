-- Drop legacy booking system tables
-- These are replaced by the new credit-based unified booking system

-- Drop views first
DROP VIEW IF EXISTS sunday_bookings_detail CASCADE;

-- Drop legacy tables
DROP TABLE IF EXISTS sunday_bookings CASCADE;
DROP TABLE IF EXISTS sunday_practice_slots CASCADE;
DROP TABLE IF EXISTS semi_private_pairings CASCADE;
DROP TABLE IF EXISTS unpaired_semi_private CASCADE;
DROP TABLE IF EXISTS schedule_changes CASCADE;
DROP TABLE IF EXISTS schedule_exceptions CASCADE;
DROP TABLE IF EXISTS time_slots CASCADE;

-- Drop legacy functions
DROP FUNCTION IF EXISTS book_sunday_slot CASCADE;
DROP FUNCTION IF EXISTS cancel_sunday_booking CASCADE;
DROP FUNCTION IF EXISTS get_next_sunday_slot CASCADE;
DROP FUNCTION IF EXISTS generate_sunday_slots CASCADE;

-- Note: This removes ALL legacy booking data
-- Active sessions should be migrated to session_bookings before running this