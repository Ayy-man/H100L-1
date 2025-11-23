-- ============================================
-- VERIFICATION & TESTING QUERIES
-- ============================================
-- Run these queries after the migration to verify everything works

-- ============================================
-- 1. VERIFY CONSTRAINT REMOVAL
-- ============================================
-- Should return 0 rows (UNIQUE constraint on firebase_uid removed)
SELECT constraint_name, constraint_type
FROM information_schema.table_constraints
WHERE table_name = 'registrations'
  AND constraint_name LIKE '%firebase_uid%';

-- ============================================
-- 2. TEST PROFILE DISPLAY NAME FUNCTION
-- ============================================
-- Should show formatted names like "PlayerName - Program Type"
SELECT
  id,
  firebase_uid,
  public.get_profile_display_name(r.*) AS profile_display_name,
  form_data->>'playerFullName' AS player_name,
  form_data->>'programType' AS program_type
FROM public.registrations r
LIMIT 5;

-- ============================================
-- 3. TEST OWNERSHIP VERIFICATION FUNCTION
-- ============================================
-- Test with real data from your registrations table
SELECT
  id,
  firebase_uid,
  form_data->>'playerFullName' AS player_name,
  public.verify_registration_ownership(id, firebase_uid) AS ownership_verified
FROM public.registrations
LIMIT 5;
-- Should return TRUE for all rows (each registration belongs to its firebase_uid)

-- ============================================
-- 4. VERIFY INDEXES CREATED
-- ============================================
SELECT
  schemaname,
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename IN ('registrations', 'sunday_bookings')
  AND indexname LIKE '%firebase%'
ORDER BY tablename, indexname;

-- ============================================
-- 5. VERIFY FUNCTIONS EXIST
-- ============================================
SELECT
  routine_name,
  routine_type,
  data_type AS return_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN (
    'get_profile_display_name',
    'verify_registration_ownership',
    'book_sunday_slot',
    'cancel_sunday_booking',
    'get_upcoming_sunday_slots',
    'get_next_sunday_slot'
  )
ORDER BY routine_name;

-- ============================================
-- 6. TEST MULTI-CHILD CAPABILITY
-- ============================================
-- Check if any firebase_uid has multiple registrations
SELECT
  firebase_uid,
  COUNT(*) AS child_count,
  string_agg(form_data->>'playerFullName', ', ') AS children_names
FROM public.registrations
WHERE firebase_uid IS NOT NULL
GROUP BY firebase_uid
HAVING COUNT(*) > 1;
-- If you have multi-child accounts, they'll show here

-- ============================================
-- 7. VERIFY RLS POLICIES
-- ============================================
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd
FROM pg_policies
WHERE tablename IN ('registrations', 'sunday_bookings')
ORDER BY tablename, policyname;

-- ============================================
-- 8. TEST GET_CHILDREN FUNCTIONALITY
-- ============================================
-- Simulate what the API does
WITH test_parent AS (
  SELECT firebase_uid
  FROM registrations
  WHERE firebase_uid IS NOT NULL
  LIMIT 1
)
SELECT
  r.id AS registration_id,
  public.get_profile_display_name(r.*) AS profile_display_name,
  r.form_data->>'playerFullName' AS player_name,
  r.form_data->>'playerCategory' AS player_category,
  r.form_data->>'programType' AS program_type,
  r.payment_status,
  r.created_at
FROM registrations r
JOIN test_parent tp ON r.firebase_uid = tp.firebase_uid
ORDER BY r.created_at;

-- ============================================
-- 9. VERIFY SUNDAY BOOKING FUNCTIONS WORK
-- ============================================
-- Test get_next_sunday_slot function with real data
SELECT public.get_next_sunday_slot(
  (SELECT id FROM registrations WHERE firebase_uid IS NOT NULL LIMIT 1),
  (SELECT firebase_uid FROM registrations WHERE firebase_uid IS NOT NULL LIMIT 1)
);

-- ============================================
-- 10. CHECK SUNDAY PRACTICE ELIGIBILITY
-- ============================================
-- Shows which registrations are eligible for Sunday practice
SELECT
  id,
  firebase_uid,
  form_data->>'playerFullName' AS player_name,
  form_data->>'playerCategory' AS category,
  form_data->>'programType' AS program_type,
  payment_status,
  CASE
    WHEN (form_data->>'programType') = 'group'
         AND payment_status IN ('succeeded', 'verified')
         AND CAST(REGEXP_REPLACE(form_data->>'playerCategory', '[^0-9]', '', 'g') AS INTEGER) BETWEEN 7 AND 15
    THEN 'ELIGIBLE'
    ELSE 'NOT ELIGIBLE'
  END AS sunday_practice_status
FROM registrations
WHERE firebase_uid IS NOT NULL
ORDER BY
  CASE WHEN payment_status IN ('succeeded', 'verified') THEN 0 ELSE 1 END,
  form_data->>'playerFullName';
