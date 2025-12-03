-- Migration: Private Sessions Sold By Unity (One at a time)
-- Date: 2024-12-03
-- Description: Updates analytics views to handle private sessions being sold individually
--              instead of as weekly subscriptions (1x/week, 2x/week)

-- =============================================================================
-- UPDATE ANALYTICS VIEWS FOR PRIVATE SESSION CHANGES
-- =============================================================================

-- Drop existing view if it exists
DROP VIEW IF EXISTS revenue_by_program CASCADE;

-- Recreate with updated logic for private sessions
-- Note: Private sessions are now sold individually (one-time payments)
-- The price is determined by Stripe, not a fixed formula
CREATE OR REPLACE VIEW revenue_by_program AS
SELECT
  form_data->>'programType' AS program_type,
  CASE
    WHEN form_data->>'programType' = 'group' THEN form_data->>'groupFrequency'
    WHEN form_data->>'programType' = 'private' THEN 'one-time'
    WHEN form_data->>'programType' = 'semi-private' THEN 'monthly'
    ELSE 'unknown'
  END AS frequency,
  COUNT(*) AS total_registrations,
  COUNT(*) FILTER (WHERE payment_status IN ('succeeded', 'verified', 'paid')) AS paid_registrations,
  -- Revenue estimates (actuals should come from Stripe)
  CASE
    WHEN form_data->>'programType' = 'group' AND form_data->>'groupFrequency' = '1x'
      THEN COUNT(*) FILTER (WHERE payment_status IN ('succeeded', 'verified', 'paid')) * 249.99
    WHEN form_data->>'programType' = 'group' AND form_data->>'groupFrequency' = '2x'
      THEN COUNT(*) FILTER (WHERE payment_status IN ('succeeded', 'verified', 'paid')) * 399.99
    WHEN form_data->>'programType' = 'semi-private'
      THEN COUNT(*) FILTER (WHERE payment_status IN ('succeeded', 'verified', 'paid')) * 349.99
    WHEN form_data->>'programType' = 'private'
      THEN NULL -- Price set in Stripe, cannot calculate here
    ELSE 0
  END AS estimated_monthly_revenue
FROM registrations
WHERE form_data->>'programType' IS NOT NULL
GROUP BY
  form_data->>'programType',
  CASE
    WHEN form_data->>'programType' = 'group' THEN form_data->>'groupFrequency'
    WHEN form_data->>'programType' = 'private' THEN 'one-time'
    WHEN form_data->>'programType' = 'semi-private' THEN 'monthly'
    ELSE 'unknown'
  END;

-- =============================================================================
-- NOTES FOR ADMIN
-- =============================================================================
--
-- IMPORTANT: Private training sessions are now sold individually (by unity).
--
-- Business Rule Changes:
-- 1. Parents can only select ONE day at a time for private training
-- 2. privateFrequency is always 'one-time' for new registrations
-- 3. Payment is a one-time invoice, not a recurring subscription
-- 4. No stripe_subscription_id for private registrations
--
-- Required Environment Variable in Vercel:
-- VITE_STRIPE_PRICE_PRIVATE_SESSION=price_xxxxx
--
-- Backward Compatibility:
-- - Existing registrations with privateFrequency='1x' or '2x' will continue to work
-- - Views handle both old and new data formats
-- - Sunday ice eligibility checks payment_status, not subscription_id (no change needed)
--
