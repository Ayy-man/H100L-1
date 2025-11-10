-- ============================================
-- REGISTRATIONS VIEW FOR OPTIMIZED PERFORMANCE
-- ============================================
-- This view extracts commonly used fields from the JSONB column
-- to improve query performance and make filtering faster.
--
-- Usage: Use this view in the admin dashboard instead of the raw table
-- Example: SELECT * FROM registrations_view WHERE player_category = 'M13'

-- Drop the view if it exists
DROP VIEW IF EXISTS public.registrations_view;

-- Create the optimized view
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
COMMENT ON VIEW public.registrations_view IS 'Optimized view extracting commonly queried fields from registrations JSONB data for better performance';

-- ============================================
-- CREATE INDEXES ON THE BASE TABLE
-- ============================================
-- These indexes improve performance when querying the JSONB data

-- Index on payment status for filtering
CREATE INDEX IF NOT EXISTS idx_registrations_payment_status
ON public.registrations(payment_status);

-- Index on created_at for date range queries
CREATE INDEX IF NOT EXISTS idx_registrations_created_at
ON public.registrations(created_at DESC);

-- GIN index on form_data JSONB for fast JSONB queries
CREATE INDEX IF NOT EXISTS idx_registrations_form_data_gin
ON public.registrations USING GIN (form_data);

-- Specific JSONB field indexes for frequently filtered fields
CREATE INDEX IF NOT EXISTS idx_registrations_player_name
ON public.registrations ((form_data->>'playerFullName'));

CREATE INDEX IF NOT EXISTS idx_registrations_parent_email
ON public.registrations ((form_data->>'parentEmail'));

CREATE INDEX IF NOT EXISTS idx_registrations_program_type
ON public.registrations ((form_data->>'programType'));

CREATE INDEX IF NOT EXISTS idx_registrations_player_category
ON public.registrations ((form_data->>'playerCategory'));

-- ============================================
-- GRANT PERMISSIONS
-- ============================================
-- Allow anon and authenticated users to read from the view
GRANT SELECT ON public.registrations_view TO anon, authenticated;

-- ============================================
-- VERIFICATION QUERIES
-- ============================================
-- Run these to verify the view is working correctly

-- Check view structure
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'registrations_view'
ORDER BY ordinal_position;

-- Test the view
SELECT
  player_name,
  player_category,
  program_type,
  parent_email,
  payment_status,
  created_at
FROM public.registrations_view
LIMIT 10;

-- Check index creation
SELECT
  schemaname,
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename = 'registrations'
ORDER BY indexname;
