-- Clean up all legacy triggers and functions
-- This removes dependencies on deleted tables

-- 1. Drop triggers on registrations table
DROP TRIGGER IF EXISTS trigger_update_slot_counts ON registrations;
DROP FUNCTION IF EXISTS trigger_update_slot_counts();

-- 2. Drop the update_time_slot_counts function
DROP FUNCTION IF EXISTS update_time_slot_counts();

-- 3. Drop any other time_slot related functions
DROP FUNCTION IF EXISTS get_available_time_slots CASCADE;
DROP FUNCTION IF EXISTS update_registration_counts CASCADE;

-- 4. Drop any remaining triggers on time_slots (if table somehow exists)
DROP TRIGGER IF EXISTS update_time_slots_trigger ON time_slots;

-- 5. Drop any views that reference time_slots
DROP VIEW IF EXISTS time_slots_with_counts CASCADE;
DROP VIEW IF EXISTS capacity_overview CASCADE;
DROP VIEW IF EXISTS capacity_utilization CASCADE;
DROP VIEW IF EXISTS analytics_summary CASCADE;

-- 6. Clean up any other legacy functions
DROP FUNCTION IF EXISTS calculate_session_capacity CASCADE;
DROP FUNCTION IF EXISTS get_session_demand CASCADE;