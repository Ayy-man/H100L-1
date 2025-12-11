-- Migration: Remove Session Type Restrictions
-- Date: 2025-12-11
-- Description: Allow all session types for all registered users
--              Remove program type restrictions from recurring_schedules and credit_purchases

-- ============================================================================
-- 1. Update recurring_schedules: Allow ALL session types (not just 'group')
-- ============================================================================

-- Drop the existing constraint that restricts to 'group' only
ALTER TABLE recurring_schedules
DROP CONSTRAINT IF EXISTS recurring_schedules_session_type_check;

-- Add new constraint that allows all session types
ALTER TABLE recurring_schedules
ADD CONSTRAINT recurring_schedules_session_type_check
CHECK (session_type = ANY (ARRAY['group'::text, 'sunday'::text, 'private'::text, 'semi_private'::text]));

-- ============================================================================
-- 2. Update credit_purchases: Add '10_pack' to allowed package types
-- ============================================================================

-- Drop the existing constraint
ALTER TABLE credit_purchases
DROP CONSTRAINT IF EXISTS credit_purchases_package_type_check;

-- Add new constraint with 10_pack included
ALTER TABLE credit_purchases
ADD CONSTRAINT credit_purchases_package_type_check
CHECK (package_type = ANY (ARRAY['single'::text, '10_pack'::text, '20_pack'::text]));

-- ============================================================================
-- 3. Add index for better query performance on session_bookings
-- ============================================================================

-- Index for date + session_type queries (used by check-availability)
CREATE INDEX IF NOT EXISTS idx_session_bookings_date_type
ON session_bookings(session_date, session_type)
WHERE status != 'cancelled';

-- Index for registration_id queries (used by my-bookings)
CREATE INDEX IF NOT EXISTS idx_session_bookings_registration
ON session_bookings(registration_id, session_date DESC)
WHERE status != 'cancelled';

-- ============================================================================
-- 4. Comments for documentation
-- ============================================================================

COMMENT ON TABLE recurring_schedules IS 'Recurring booking schedules - supports all session types (group, sunday, private, semi_private)';
COMMENT ON TABLE credit_purchases IS 'Credit package purchases - supports single, 10_pack, and 20_pack packages';
COMMENT ON TABLE session_bookings IS 'Individual session bookings - all registered players can book any session type';
