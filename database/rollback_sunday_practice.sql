-- ============================================
-- ROLLBACK: Sunday Real Ice Practice Booking System
-- ============================================
-- This script removes all Sunday practice booking system components.
-- Use this if you need to undo the migration.
--
-- WARNING: This will delete ALL Sunday practice bookings and slots!
-- Make sure to backup your data before running this.
--
-- Run this in Supabase SQL Editor:
-- 1. Copy entire script
-- 2. Paste in SQL Editor
-- 3. Click "Run"

-- ============================================
-- STEP 1: Drop RLS Policies
-- ============================================

DROP POLICY IF EXISTS "Anyone can view active slots" ON public.sunday_practice_slots;
DROP POLICY IF EXISTS "Users can view own bookings" ON public.sunday_bookings;
DROP POLICY IF EXISTS "Service role full access slots" ON public.sunday_practice_slots;
DROP POLICY IF EXISTS "Service role full access bookings" ON public.sunday_bookings;

-- ============================================
-- STEP 2: Revoke Permissions
-- ============================================

REVOKE SELECT ON public.sunday_practice_slots FROM authenticated;
REVOKE SELECT ON public.sunday_bookings FROM authenticated;
REVOKE SELECT ON public.sunday_bookings_detail FROM authenticated;

REVOKE EXECUTE ON FUNCTION public.book_sunday_slot FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.cancel_sunday_booking FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.get_next_sunday_slot FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.generate_sunday_slots FROM service_role;

-- ============================================
-- STEP 3: Drop Database Functions
-- ============================================

DROP FUNCTION IF EXISTS public.book_sunday_slot(UUID, UUID, TEXT);
DROP FUNCTION IF EXISTS public.cancel_sunday_booking(UUID, TEXT);
DROP FUNCTION IF EXISTS public.get_next_sunday_slot(UUID, TEXT);
DROP FUNCTION IF EXISTS public.generate_sunday_slots(INTEGER);

-- ============================================
-- STEP 4: Drop View
-- ============================================

DROP VIEW IF EXISTS public.sunday_bookings_detail;

-- ============================================
-- STEP 5: Drop Tables
-- ============================================
-- Note: This will CASCADE delete all bookings when slots are deleted

DROP TABLE IF EXISTS public.sunday_bookings CASCADE;
DROP TABLE IF EXISTS public.sunday_practice_slots CASCADE;

-- ============================================
-- VERIFICATION
-- ============================================

-- Check tables are gone
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('sunday_practice_slots', 'sunday_bookings');
-- Should return 0 rows

-- Check view is gone
SELECT table_name
FROM information_schema.views
WHERE table_schema = 'public'
  AND table_name = 'sunday_bookings_detail';
-- Should return 0 rows

-- Check functions are gone
SELECT routine_name
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name LIKE '%sunday%';
-- Should return 0 rows

-- ============================================
-- ROLLBACK COMPLETE
-- ============================================
-- Sunday Practice booking system has been removed.
--
-- To re-install, run: migration_sunday_practice.sql
