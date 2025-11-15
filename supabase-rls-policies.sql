-- ============================================
-- Row Level Security (RLS) Policies Fix
-- ============================================
-- This file contains SQL to enable proper RLS policies for the admin panel
-- Run these commands in your Supabase SQL Editor

-- First, check if RLS is enabled (it should be for security)
-- If RLS is enabled but no policies exist, all operations will fail

-- ============================================
-- Option 1: Enable all operations (LESS SECURE - for development only)
-- ============================================
-- Uncomment these if you want to temporarily disable RLS for testing
-- WARNING: This removes all security - anyone can read/write/delete

-- ALTER TABLE public.registrations DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.time_slots DISABLE ROW LEVEL SECURITY;

-- ============================================
-- Option 2: Create proper RLS policies (RECOMMENDED)
-- ============================================
-- This allows all operations for authenticated users only

-- For registrations table
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON public.registrations;
CREATE POLICY "Enable all access for authenticated users"
ON public.registrations
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- For time_slots table
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON public.time_slots;
CREATE POLICY "Enable all access for authenticated users"
ON public.time_slots
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- ============================================
-- Option 3: Allow public access (LEAST SECURE)
-- ============================================
-- Use this if you need the anon key to work without authentication
-- WARNING: This allows anyone with your anon key to delete data

-- For registrations table
DROP POLICY IF EXISTS "Enable all access for anon users" ON public.registrations;
CREATE POLICY "Enable all access for anon users"
ON public.registrations
FOR ALL
TO anon
USING (true)
WITH CHECK (true);

-- For time_slots table
DROP POLICY IF EXISTS "Enable all access for anon users" ON public.time_slots;
CREATE POLICY "Enable all access for anon users"
ON public.time_slots
FOR ALL
TO anon
USING (true)
WITH CHECK (true);

-- ============================================
-- Verify policies are created
-- ============================================
-- Run this to see all policies on your tables:
-- SELECT schemaname, tablename, policyname, permissive, roles, cmd
-- FROM pg_policies
-- WHERE schemaname = 'public';
