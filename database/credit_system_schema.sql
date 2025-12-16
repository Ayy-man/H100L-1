-- ============================================================================
-- CREDIT SYSTEM DATABASE SCHEMA
-- ============================================================================
-- SniperZone Hockey Training - Credit-Based Payment System
--
-- This schema supports:
-- - Parent-level credit balance (shared across all children)
-- - Credit package purchases (single $40, 20-pack $500)
-- - Session bookings (group training uses credits, others are pay-per-session)
-- - Recurring weekly booking schedules
--
-- Created: December 11, 2025
-- ============================================================================

-- ============================================================================
-- TABLE: parent_credits
-- ============================================================================
-- Stores the credit balance for each parent (at firebase_uid level)
-- Credits are shared across all children registered under the same parent

CREATE TABLE IF NOT EXISTS parent_credits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    firebase_uid TEXT NOT NULL UNIQUE,
    total_credits INTEGER NOT NULL DEFAULT 0 CHECK (total_credits >= 0),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast lookups by firebase_uid
CREATE INDEX IF NOT EXISTS idx_parent_credits_firebase_uid
    ON parent_credits(firebase_uid);

-- Trigger to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_parent_credits_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_parent_credits_updated ON parent_credits;
CREATE TRIGGER trigger_parent_credits_updated
    BEFORE UPDATE ON parent_credits
    FOR EACH ROW
    EXECUTE FUNCTION update_parent_credits_timestamp();

-- ============================================================================
-- TABLE: credit_purchases
-- ============================================================================
-- Log of all credit package purchases
-- Tracks which credits from which purchase are used (FIFO - oldest first)

CREATE TABLE IF NOT EXISTS credit_purchases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    firebase_uid TEXT NOT NULL,

    -- Package details
    package_type TEXT NOT NULL CHECK (package_type IN ('single', '10_pack', '20_pack', '50_pack')),
    credits_purchased INTEGER NOT NULL CHECK (credits_purchased > 0),
    price_paid NUMERIC(10,2) NOT NULL CHECK (price_paid >= 0),
    currency TEXT DEFAULT 'cad',

    -- Stripe references
    stripe_payment_intent_id TEXT,
    stripe_checkout_session_id TEXT UNIQUE,

    -- Timing
    purchased_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,

    -- Tracking remaining credits from this specific purchase
    credits_remaining INTEGER NOT NULL CHECK (credits_remaining >= 0),

    -- Status
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'expired', 'exhausted')),

    -- Foreign key to parent_credits (creates parent record if needed via trigger)
    CONSTRAINT fk_credit_purchase_parent FOREIGN KEY (firebase_uid)
        REFERENCES parent_credits(firebase_uid)
        ON DELETE RESTRICT
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_credit_purchases_firebase_uid
    ON credit_purchases(firebase_uid);
CREATE INDEX IF NOT EXISTS idx_credit_purchases_status
    ON credit_purchases(status, expires_at);
CREATE INDEX IF NOT EXISTS idx_credit_purchases_stripe_session
    ON credit_purchases(stripe_checkout_session_id);

-- ============================================================================
-- TABLE: session_bookings
-- ============================================================================
-- Individual session reservations
-- Unified table for all session types (group, sunday, private, semi_private)

CREATE TABLE IF NOT EXISTS session_bookings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    firebase_uid TEXT NOT NULL,
    registration_id UUID NOT NULL REFERENCES registrations(id) ON DELETE CASCADE,

    -- Session details
    session_type TEXT NOT NULL CHECK (session_type IN ('group', 'sunday', 'private', 'semi_private')),
    session_date DATE NOT NULL,
    time_slot TEXT NOT NULL,

    -- Credit tracking (for group sessions paid with credits)
    credits_used INTEGER NOT NULL DEFAULT 0 CHECK (credits_used >= 0),
    credit_purchase_id UUID REFERENCES credit_purchases(id),

    -- Payment tracking (for direct-pay sessions: sunday, private, semi_private)
    price_paid NUMERIC(10,2),
    stripe_payment_intent_id TEXT,

    -- Recurring booking support
    is_recurring BOOLEAN DEFAULT FALSE,
    recurring_schedule_id UUID,

    -- Status tracking
    status TEXT NOT NULL DEFAULT 'booked' CHECK (status IN ('booked', 'attended', 'cancelled', 'no_show')),
    cancelled_at TIMESTAMPTZ,
    cancellation_reason TEXT,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Prevent double-booking same child in same slot
    CONSTRAINT unique_booking UNIQUE (registration_id, session_date, time_slot, session_type)
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_session_bookings_firebase_uid
    ON session_bookings(firebase_uid);
CREATE INDEX IF NOT EXISTS idx_session_bookings_date
    ON session_bookings(session_date);
CREATE INDEX IF NOT EXISTS idx_session_bookings_registration
    ON session_bookings(registration_id);
CREATE INDEX IF NOT EXISTS idx_session_bookings_status
    ON session_bookings(status);
CREATE INDEX IF NOT EXISTS idx_session_bookings_recurring
    ON session_bookings(recurring_schedule_id) WHERE recurring_schedule_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_session_bookings_date_time
    ON session_bookings(session_date, time_slot, session_type);

-- Trigger to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_session_bookings_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_session_bookings_updated ON session_bookings;
CREATE TRIGGER trigger_session_bookings_updated
    BEFORE UPDATE ON session_bookings
    FOR EACH ROW
    EXECUTE FUNCTION update_session_bookings_timestamp();

-- ============================================================================
-- TABLE: recurring_schedules
-- ============================================================================
-- Optional weekly auto-booking schedules
-- System will auto-book sessions and deduct credits weekly

CREATE TABLE IF NOT EXISTS recurring_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    firebase_uid TEXT NOT NULL,
    registration_id UUID NOT NULL REFERENCES registrations(id) ON DELETE CASCADE,

    -- Schedule details
    session_type TEXT NOT NULL CHECK (session_type IN ('group')), -- Only group for now
    day_of_week TEXT NOT NULL CHECK (day_of_week IN ('monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday')),
    time_slot TEXT NOT NULL,

    -- Active status
    is_active BOOLEAN DEFAULT TRUE,
    paused_reason TEXT CHECK (paused_reason IN ('insufficient_credits', 'user_paused', 'slot_unavailable') OR paused_reason IS NULL),

    -- Booking tracking
    last_booked_date DATE,
    next_booking_date DATE,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- One recurring schedule per child per day/slot
    CONSTRAINT unique_recurring UNIQUE (registration_id, day_of_week, time_slot)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_recurring_schedules_firebase_uid
    ON recurring_schedules(firebase_uid);
CREATE INDEX IF NOT EXISTS idx_recurring_schedules_active
    ON recurring_schedules(is_active, next_booking_date);
CREATE INDEX IF NOT EXISTS idx_recurring_schedules_registration
    ON recurring_schedules(registration_id);

-- Trigger to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_recurring_schedules_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_recurring_schedules_updated ON recurring_schedules;
CREATE TRIGGER trigger_recurring_schedules_updated
    BEFORE UPDATE ON recurring_schedules
    FOR EACH ROW
    EXECUTE FUNCTION update_recurring_schedules_timestamp();

-- ============================================================================
-- TABLE: credit_adjustments
-- ============================================================================
-- Admin-initiated credit adjustments (add/remove credits)
-- For customer service, corrections, promotions, etc.

CREATE TABLE IF NOT EXISTS credit_adjustments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    firebase_uid TEXT NOT NULL REFERENCES parent_credits(firebase_uid),

    -- Adjustment details
    adjustment INTEGER NOT NULL, -- Positive = add, Negative = subtract
    balance_before INTEGER NOT NULL,
    balance_after INTEGER NOT NULL,
    reason TEXT NOT NULL,

    -- Admin tracking
    admin_id TEXT NOT NULL,
    admin_email TEXT,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for audit trail queries
CREATE INDEX IF NOT EXISTS idx_credit_adjustments_firebase_uid
    ON credit_adjustments(firebase_uid);
CREATE INDEX IF NOT EXISTS idx_credit_adjustments_admin
    ON credit_adjustments(admin_id);

-- ============================================================================
-- FUNCTIONS: Credit Management
-- ============================================================================

-- Function to get available credits for a parent (FIFO - oldest expiring first)
CREATE OR REPLACE FUNCTION get_available_credits(p_firebase_uid TEXT)
RETURNS TABLE (
    purchase_id UUID,
    credits_remaining INTEGER,
    expires_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        cp.id,
        cp.credits_remaining,
        cp.expires_at
    FROM credit_purchases cp
    WHERE cp.firebase_uid = p_firebase_uid
      AND cp.status = 'active'
      AND cp.credits_remaining > 0
      AND cp.expires_at > NOW()
    ORDER BY cp.expires_at ASC; -- FIFO: use oldest first
END;
$$ LANGUAGE plpgsql;

-- Function to deduct a credit (returns the purchase_id that was debited)
CREATE OR REPLACE FUNCTION deduct_credit(
    p_firebase_uid TEXT,
    p_credits_to_deduct INTEGER DEFAULT 1
)
RETURNS UUID AS $$
DECLARE
    v_purchase_id UUID;
    v_remaining INTEGER;
BEGIN
    -- Find the oldest active purchase with remaining credits
    SELECT id, credits_remaining
    INTO v_purchase_id, v_remaining
    FROM credit_purchases
    WHERE firebase_uid = p_firebase_uid
      AND status = 'active'
      AND credits_remaining >= p_credits_to_deduct
      AND expires_at > NOW()
    ORDER BY expires_at ASC
    LIMIT 1
    FOR UPDATE;

    IF v_purchase_id IS NULL THEN
        RAISE EXCEPTION 'Insufficient credits for firebase_uid: %', p_firebase_uid;
    END IF;

    -- Deduct from the purchase
    UPDATE credit_purchases
    SET
        credits_remaining = credits_remaining - p_credits_to_deduct,
        status = CASE
            WHEN credits_remaining - p_credits_to_deduct = 0 THEN 'exhausted'
            ELSE status
        END
    WHERE id = v_purchase_id;

    -- Update parent total
    UPDATE parent_credits
    SET total_credits = total_credits - p_credits_to_deduct
    WHERE firebase_uid = p_firebase_uid;

    RETURN v_purchase_id;
END;
$$ LANGUAGE plpgsql;

-- Function to refund a credit (when cancellation is allowed)
CREATE OR REPLACE FUNCTION refund_credit(
    p_firebase_uid TEXT,
    p_purchase_id UUID,
    p_credits_to_refund INTEGER DEFAULT 1
)
RETURNS BOOLEAN AS $$
BEGIN
    -- Restore to the original purchase if possible
    UPDATE credit_purchases
    SET
        credits_remaining = credits_remaining + p_credits_to_refund,
        status = 'active'
    WHERE id = p_purchase_id
      AND firebase_uid = p_firebase_uid;

    -- Update parent total
    UPDATE parent_credits
    SET total_credits = total_credits + p_credits_to_refund
    WHERE firebase_uid = p_firebase_uid;

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Function to check if cancellation is allowed (24h+ before session)
CREATE OR REPLACE FUNCTION can_cancel_with_refund(p_booking_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    v_session_datetime TIMESTAMPTZ;
BEGIN
    SELECT (session_date + time_slot::time)::timestamptz
    INTO v_session_datetime
    FROM session_bookings
    WHERE id = p_booking_id;

    -- Allow refund if more than 24 hours before session
    RETURN v_session_datetime > (NOW() + INTERVAL '24 hours');
END;
$$ LANGUAGE plpgsql;

-- Function to get slot capacity/availability
CREATE OR REPLACE FUNCTION get_slot_capacity(
    p_session_date DATE,
    p_time_slot TEXT,
    p_session_type TEXT,
    p_max_capacity INTEGER DEFAULT 6
)
RETURNS TABLE (
    current_bookings BIGINT,
    available_spots BIGINT,
    is_available BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        COUNT(*)::BIGINT as current_bookings,
        (p_max_capacity - COUNT(*))::BIGINT as available_spots,
        (COUNT(*) < p_max_capacity) as is_available
    FROM session_bookings
    WHERE session_date = p_session_date
      AND time_slot = p_time_slot
      AND session_type = p_session_type
      AND status IN ('booked', 'attended');
END;
$$ LANGUAGE plpgsql;

-- Function to expire old credits (run via CRON)
CREATE OR REPLACE FUNCTION expire_old_credits()
RETURNS INTEGER AS $$
DECLARE
    v_expired_count INTEGER;
BEGIN
    -- Mark expired purchases
    WITH expired AS (
        UPDATE credit_purchases
        SET status = 'expired'
        WHERE status = 'active'
          AND expires_at <= NOW()
        RETURNING firebase_uid, credits_remaining
    )
    -- Update parent totals
    UPDATE parent_credits pc
    SET total_credits = pc.total_credits - e.total_expired
    FROM (
        SELECT firebase_uid, SUM(credits_remaining) as total_expired
        FROM expired
        GROUP BY firebase_uid
    ) e
    WHERE pc.firebase_uid = e.firebase_uid;

    GET DIAGNOSTICS v_expired_count = ROW_COUNT;
    RETURN v_expired_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- VIEWS: Helpful aggregations
-- ============================================================================

-- View: Credit balance summary per parent
CREATE OR REPLACE VIEW credit_balance_summary AS
SELECT
    pc.firebase_uid,
    pc.total_credits,
    COALESCE(expiring.expiring_soon, 0) as credits_expiring_30_days,
    expiring.next_expiry_date
FROM parent_credits pc
LEFT JOIN LATERAL (
    SELECT
        SUM(credits_remaining) as expiring_soon,
        MIN(expires_at) as next_expiry_date
    FROM credit_purchases
    WHERE firebase_uid = pc.firebase_uid
      AND status = 'active'
      AND expires_at <= NOW() + INTERVAL '30 days'
      AND expires_at > NOW()
) expiring ON TRUE;

-- View: Upcoming bookings with player info
CREATE OR REPLACE VIEW upcoming_bookings_view AS
SELECT
    sb.id,
    sb.firebase_uid,
    sb.registration_id,
    sb.session_type,
    sb.session_date,
    sb.time_slot,
    sb.credits_used,
    sb.price_paid,
    sb.is_recurring,
    sb.status,
    sb.created_at,
    r.form_data->>'playerFullName' as player_name,
    r.form_data->>'playerCategory' as player_category
FROM session_bookings sb
JOIN registrations r ON r.id = sb.registration_id
WHERE sb.session_date >= CURRENT_DATE
  AND sb.status = 'booked'
ORDER BY sb.session_date, sb.time_slot;

-- View: Daily booking counts for capacity display
CREATE OR REPLACE VIEW daily_booking_counts AS
SELECT
    session_date,
    time_slot,
    session_type,
    COUNT(*) as booking_count
FROM session_bookings
WHERE status IN ('booked', 'attended')
GROUP BY session_date, time_slot, session_type;

-- ============================================================================
-- GRANTS: Row Level Security will be in separate file
-- ============================================================================
-- Note: RLS policies are in credit_system_realtime.sql

-- ============================================================================
-- SAMPLE DATA (for testing - comment out in production)
-- ============================================================================
--
-- INSERT INTO parent_credits (firebase_uid, total_credits) VALUES
--     ('test_user_123', 15);
--
-- INSERT INTO credit_purchases (firebase_uid, package_type, credits_purchased, price_paid, expires_at, credits_remaining) VALUES
--     ('test_user_123', '20_pack', 20, 500.00, NOW() + INTERVAL '12 months', 15);
