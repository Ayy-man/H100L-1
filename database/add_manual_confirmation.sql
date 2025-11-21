-- Add manual confirmation fields to registrations table
-- This allows admins to manually confirm payments for offline payments,
-- error overrides, or manual Stripe verification

ALTER TABLE registrations
ADD COLUMN IF NOT EXISTS manually_confirmed BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS manually_confirmed_by TEXT,
ADD COLUMN IF NOT EXISTS manually_confirmed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS manually_confirmed_reason TEXT;

-- Add comment to explain the fields
COMMENT ON COLUMN registrations.manually_confirmed IS 'Indicates if payment was manually confirmed by an admin';
COMMENT ON COLUMN registrations.manually_confirmed_by IS 'Email of admin who confirmed payment';
COMMENT ON COLUMN registrations.manually_confirmed_at IS 'Timestamp when payment was manually confirmed';
COMMENT ON COLUMN registrations.manually_confirmed_reason IS 'Reason for manual confirmation (e.g., offline payment, error override)';
