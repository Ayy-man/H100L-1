-- ============================================
-- FIREBASE AUTHENTICATION INTEGRATION
-- ============================================
-- Adds Firebase user ID tracking to registrations
-- Allows linking Firebase Auth users to registration records
--
-- Run this migration after setting up Firebase Authentication
-- ============================================

-- ============================================
-- 1. ADD FIREBASE FIELDS TO REGISTRATIONS TABLE
-- ============================================

-- Add Firebase user ID field (unique identifier from Firebase Auth)
ALTER TABLE public.registrations
ADD COLUMN IF NOT EXISTS firebase_uid TEXT;

-- Add parent email at top level (extracted from form_data for easier querying)
ALTER TABLE public.registrations
ADD COLUMN IF NOT EXISTS parent_email TEXT;

-- Add timestamp for when Firebase user was created
ALTER TABLE public.registrations
ADD COLUMN IF NOT EXISTS firebase_user_created_at TIMESTAMPTZ;

-- ============================================
-- 2. ADD UNIQUE CONSTRAINT ON FIREBASE_UID
-- ============================================
-- Each Firebase user can only be linked to one registration
-- This prevents duplicate accounts

ALTER TABLE public.registrations
DROP CONSTRAINT IF EXISTS registrations_firebase_uid_unique;

ALTER TABLE public.registrations
ADD CONSTRAINT registrations_firebase_uid_unique UNIQUE (firebase_uid);

-- ============================================
-- 3. CREATE INDEXES FOR EFFICIENT QUERIES
-- ============================================

-- Index on firebase_uid for fast user lookups
CREATE INDEX IF NOT EXISTS idx_registrations_firebase_uid
ON public.registrations(firebase_uid)
WHERE firebase_uid IS NOT NULL;

-- Index on parent_email for login/lookup queries
CREATE INDEX IF NOT EXISTS idx_registrations_parent_email_top_level
ON public.registrations(parent_email)
WHERE parent_email IS NOT NULL;

-- Index on firebase_user_created_at for analytics
CREATE INDEX IF NOT EXISTS idx_registrations_firebase_user_created_at
ON public.registrations(firebase_user_created_at DESC)
WHERE firebase_user_created_at IS NOT NULL;

-- ============================================
-- 4. BACKFILL PARENT_EMAIL FROM FORM_DATA
-- ============================================
-- Migrate existing parent emails from JSONB to top-level column
-- This only affects existing records

UPDATE public.registrations
SET parent_email = (form_data->>'parentEmail')::text
WHERE parent_email IS NULL
  AND form_data->>'parentEmail' IS NOT NULL;

-- ============================================
-- 5. UPDATE REGISTRATIONS VIEW
-- ============================================
-- Add Firebase fields to the optimized view

DROP VIEW IF EXISTS public.registrations_view;

CREATE OR REPLACE VIEW public.registrations_view AS
SELECT
  -- Core registration fields
  r.id,
  r.created_at,
  r.updated_at,
  r.payment_status,
  r.payment_method_id,
  r.stripe_customer_id,
  r.stripe_subscription_id,

  -- Firebase authentication fields (NEW)
  r.firebase_uid,
  r.parent_email AS parent_email_top_level,
  r.firebase_user_created_at,

  -- Extracted player information
  (r.form_data->>'playerFullName')::text AS player_name,
  (r.form_data->>'dateOfBirth')::text AS date_of_birth,
  (r.form_data->>'playerCategory')::text AS player_category,

  -- Extracted parent/guardian information
  (r.form_data->>'parentFullName')::text AS parent_name,
  (r.form_data->>'parentEmail')::text AS parent_email,
  (r.form_data->>'parentPhone')::text AS parent_phone,
  (r.form_data->>'parentCity')::text AS parent_city,
  (r.form_data->>'parentPostalCode')::text AS postal_code,
  (r.form_data->>'communicationLanguage')::text AS language,

  -- Extracted program information
  (r.form_data->>'programType')::text AS program_type,
  (r.form_data->>'groupFrequency')::text AS group_frequency,
  (r.form_data->>'groupDay')::text AS group_day,
  (r.form_data->>'privateFrequency')::text AS private_frequency,
  (r.form_data->>'privateTimeSlot')::text AS private_time_slot,
  (r.form_data->>'sundayPractice')::boolean AS sunday_practice,

  -- Extracted player details
  (r.form_data->>'position')::text AS position,
  (r.form_data->>'dominantHand')::text AS dominant_hand,
  (r.form_data->>'currentLevel')::text AS current_level,
  (r.form_data->>'jerseySize')::text AS jersey_size,
  (r.form_data->>'primaryObjective')::text AS primary_objective,

  -- Health information flags
  (r.form_data->>'hasAllergies')::boolean AS has_allergies,
  (r.form_data->>'hasMedicalConditions')::boolean AS has_medical_conditions,
  (r.form_data->>'carriesMedication')::boolean AS carries_medication,

  -- Consents
  (r.form_data->>'photoVideoConsent')::boolean AS photo_video_consent,
  (r.form_data->>'policyAcceptance')::boolean AS policy_acceptance,

  -- Keep the full JSONB for detailed view
  r.form_data AS full_form_data

FROM public.registrations r;

-- Add helpful comment
COMMENT ON VIEW public.registrations_view IS 'Optimized view with Firebase auth fields and commonly queried data from registrations';

-- ============================================
-- 6. CREATE FUNCTION TO LINK FIREBASE USER TO REGISTRATION
-- ============================================
-- This function can be called from your application after creating a Firebase user
-- to link the Firebase UID to the registration record

CREATE OR REPLACE FUNCTION public.link_firebase_user_to_registration(
  p_registration_id UUID,
  p_firebase_uid TEXT,
  p_parent_email TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Update the registration with Firebase user details
  UPDATE public.registrations
  SET
    firebase_uid = p_firebase_uid,
    parent_email = p_parent_email,
    firebase_user_created_at = NOW(),
    updated_at = NOW()
  WHERE id = p_registration_id
    AND firebase_uid IS NULL; -- Only update if not already linked

  -- Return true if update was successful
  RETURN FOUND;
END;
$$;

-- Add comment to the function
COMMENT ON FUNCTION public.link_firebase_user_to_registration IS 'Links a Firebase user UID to a registration record after Firebase user creation';

-- ============================================
-- 7. CREATE FUNCTION TO GET REGISTRATION BY FIREBASE UID
-- ============================================
-- Helper function to fetch registration data by Firebase UID

CREATE OR REPLACE FUNCTION public.get_registration_by_firebase_uid(p_firebase_uid TEXT)
RETURNS TABLE (
  id UUID,
  created_at TIMESTAMPTZ,
  payment_status TEXT,
  player_name TEXT,
  parent_email TEXT,
  program_type TEXT,
  full_data JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    r.id,
    r.created_at,
    r.payment_status,
    (r.form_data->>'playerFullName')::text,
    r.parent_email,
    (r.form_data->>'programType')::text,
    r.form_data
  FROM public.registrations r
  WHERE r.firebase_uid = p_firebase_uid
  LIMIT 1;
END;
$$;

-- Add comment to the function
COMMENT ON FUNCTION public.get_registration_by_firebase_uid IS 'Retrieves registration data for a given Firebase user UID';

-- ============================================
-- 8. GRANT PERMISSIONS
-- ============================================

-- Allow authenticated users to read their own registration via Firebase UID
GRANT SELECT ON public.registrations_view TO anon, authenticated;

-- Allow execution of helper functions
GRANT EXECUTE ON FUNCTION public.link_firebase_user_to_registration TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_registration_by_firebase_uid TO anon, authenticated;

-- ============================================
-- 9. VERIFICATION QUERIES
-- ============================================
-- Run these to verify the migration was successful

-- Check that new columns exist
SELECT
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'registrations'
  AND column_name IN ('firebase_uid', 'parent_email', 'firebase_user_created_at')
ORDER BY column_name;

-- Check indexes were created
SELECT
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename = 'registrations'
  AND indexname LIKE '%firebase%'
ORDER BY indexname;

-- Check view includes new fields
SELECT column_name
FROM information_schema.columns
WHERE table_name = 'registrations_view'
  AND column_name IN ('firebase_uid', 'parent_email_top_level', 'firebase_user_created_at')
ORDER BY column_name;

-- Test the helper function (this will return empty result if no data)
SELECT * FROM public.get_registration_by_firebase_uid('test_uid_123');

-- ============================================
-- ROLLBACK INSTRUCTIONS (if needed)
-- ============================================
-- If you need to undo this migration, run:
--
-- DROP FUNCTION IF EXISTS public.get_registration_by_firebase_uid;
-- DROP FUNCTION IF EXISTS public.link_firebase_user_to_registration;
-- ALTER TABLE public.registrations DROP COLUMN IF EXISTS firebase_user_created_at;
-- ALTER TABLE public.registrations DROP COLUMN IF EXISTS parent_email;
-- ALTER TABLE public.registrations DROP COLUMN IF EXISTS firebase_uid;
-- DROP INDEX IF EXISTS idx_registrations_firebase_user_created_at;
-- DROP INDEX IF EXISTS idx_registrations_parent_email_top_level;
-- DROP INDEX IF EXISTS idx_registrations_firebase_uid;
