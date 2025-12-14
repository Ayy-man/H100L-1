-- ============================================================================
-- CREDIT SYSTEM DATABASE SCHEMA
-- ============================================================================
-- SniperZone Hockey Training - Credit-Based Payment System
--
-- This schema supports:
-- - Parent-level credit balance (shared across all children)
-- - Credit package purchases (single, 10_pack, 20_pack)
-- - Session bookings (group training uses credits, others are pay-per-session)
-- - Recurring weekly booking schedules
-- - Admin credit adjustments with audit trail
--
-- Created: December 14, 2025
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
    package_type TEXT NOT NULL CHECK (package_type IN ('single', '10_pack', '20_pack')),
    credits_purchased INTEGER NOT NULL CHECK (credits_purchased > 0),
    price_paid NUMERIC NOT NULL CHECK (price_paid >= 0),
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
    registration_id UUID NOT NULL,

    -- Session details
    session_type TEXT NOT NULL CHECK (session_type IN ('group', 'sunday', 'private', 'semi_private')),
    session_date DATE NOT NULL,
    time_slot TEXT NOT NULL,

    -- Credit usage
    credits_used INTEGER NOT NULL DEFAULT 0 CHECK (credits_used >= 0),
    credit_purchase_id UUID REFERENCES credit_purchases(id),

    -- Payment for non-credit sessions
    price_paid NUMERIC,
    stripe_payment_intent_id TEXT,

    -- Recurring support
    is_recurring BOOLEAN DEFAULT false,
    recurring_schedule_id UUID,

    -- Status tracking
    status TEXT NOT NULL DEFAULT 'booked' CHECK (status IN ('booked', 'attended', 'cancelled', 'no_show')),
    cancelled_at TIMESTAMPTZ,
    cancellation_reason TEXT,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Foreign keys
    CONSTRAINT fk_session_booking_registration FOREIGN KEY (registration_id)
        REFERENCES registrations(id)
        ON DELETE CASCADE,
    CONSTRAINT fk_session_booking_credit_purchase FOREIGN KEY (credit_purchase_id)
        REFERENCES credit_purchases(id)
        ON DELETE SET NULL
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_session_bookings_firebase_uid
    ON session_bookings(firebase_uid);
CREATE INDEX IF NOT EXISTS idx_session_bookings_session_date
    ON session_bookings(session_date, session_type);
CREATE INDEX IF NOT EXISTS idx_session_bookings_registration
    ON session_bookings(registration_id);

-- ============================================================================
-- TABLE: recurring_schedules
-- ============================================================================
-- Weekly recurring booking schedules
-- Used for automatic booking of regular weekly sessions

CREATE TABLE IF NOT EXISTS recurring_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    firebase_uid TEXT NOT NULL,
    registration_id UUID NOT NULL,

    -- Schedule details
    session_type TEXT NOT NULL CHECK (session_type IN ('group', 'sunday', 'private', 'semi_private')),
    day_of_week TEXT NOT NULL CHECK (day_of_week IN ('monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday')),
    time_slot TEXT NOT NULL,

    -- Status
    is_active BOOLEAN DEFAULT true,
    paused_reason TEXT CHECK (paused_reason IN ('insufficient_credits', 'user_paused', 'slot_unavailable')),

    -- Tracking
    last_booked_date DATE,
    next_booking_date DATE,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Foreign key
    CONSTRAINT fk_recurring_schedule_registration FOREIGN KEY (registration_id)
        REFERENCES registrations(id)
        ON DELETE CASCADE
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_recurring_schedules_firebase_uid
    ON recurring_schedules(firebase_uid);
CREATE INDEX IF NOT EXISTS idx_recurring_schedules_active
    ON recurring_schedules(is_active, day_of_week);

-- ============================================================================
-- TABLE: credit_adjustments
-- ============================================================================
-- Admin-initiated credit adjustments with full audit trail

CREATE TABLE IF NOT EXISTS credit_adjustments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    firebase_uid TEXT NOT NULL,
    adjustment_amount INTEGER NOT NULL,
    balance_before INTEGER NOT NULL,
    balance_after INTEGER NOT NULL,
    reason TEXT NOT NULL,
    admin_id TEXT NOT NULL,
    admin_email TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),

    -- Foreign key
    CONSTRAINT fk_credit_adjustment_parent FOREIGN KEY (firebase_uid)
        REFERENCES parent_credits(firebase_uid)
        ON DELETE RESTRICT
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_credit_adjustments_firebase_uid
    ON credit_adjustments(firebase_uid);
CREATE INDEX IF NOT EXISTS idx_credit_adjustments_admin
    ON credit_adjustments(admin_id, created_at);

-- ============================================================================
-- TABLE: notifications
-- ============================================================================
-- System notifications for users and admins

CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL,
    user_type TEXT NOT NULL CHECK (user_type IN ('parent', 'admin')),
    type TEXT NOT NULL CHECK (type IN (
        'pairing_created', 'pairing_dissolved', 'schedule_changed',
        'payment_confirmed', 'payment_received', 'sunday_booking',
        'sunday_reminder', 'waitlist_update', 'admin_message', 'system'
    )),
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
    read BOOLEAN NOT NULL DEFAULT false,
    read_at TIMESTAMPTZ,
    data JSONB,
    action_url TEXT,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_notifications_user_id
    ON notifications(user_id, user_type);
CREATE INDEX IF NOT EXISTS idx_notifications_read
    ON notifications(read, created_at);

-- ============================================================================
-- FUNCTIONS FOR CREDIT MANAGEMENT
-- ============================================================================

-- Function to get or create parent credit record
CREATE OR REPLACE FUNCTION get_or_create_parent_credits(p_firebase_uid TEXT)
RETURNS UUID AS $$
DECLARE
    parent_id UUID;
BEGIN
    -- Try to get existing record
    SELECT id INTO parent_id FROM parent_credits WHERE firebase_uid = p_firebase_uid;

    -- If not found, create new record
    IF parent_id IS NULL THEN
        INSERT INTO parent_credits (firebase_uid, total_credits)
        VALUES (p_firebase_uid, 0)
        RETURNING id INTO parent_id;
    END IF;

    RETURN parent_id;
END;
$$ LANGUAGE plpgsql;

-- Function to update parent credit balance
CREATE OR REPLACE FUNCTION update_parent_credit_balance(
    p_firebase_uid TEXT,
    p_credit_change INTEGER
) RETURNS INTEGER AS $$
DECLARE
    new_balance INTEGER;
BEGIN
    UPDATE parent_credits
    SET total_credits = total_credits + p_credit_change,
        updated_at = NOW()
    WHERE firebase_uid = p_firebase_uid
    RETURNING total_credits INTO new_balance;

    RETURN new_balance;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- TRIGGERS FOR AUTOMATIC UPDATES
-- ============================================================================

-- Trigger to create parent_credits record when credit_purchase is created
CREATE OR REPLACE FUNCTION create_parent_credits_trigger()
RETURNS TRIGGER AS $$
BEGIN
    -- Insert parent_credits record if it doesn't exist
    INSERT INTO parent_credits (firebase_uid, total_credits)
    VALUES (NEW.firebase_uid, NEW.credits_purchased)
    ON CONFLICT (firebase_uid) DO UPDATE
        SET total_credits = parent_credits.total_credits + EXCLUDED.credits_purchased;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_create_parent_credits ON credit_purchases;
CREATE TRIGGER trigger_create_parent_credits
    AFTER INSERT ON credit_purchases
    FOR EACH ROW
    EXECUTE FUNCTION create_parent_credits_trigger();

-- ============================================================================
-- VIEWS FOR COMMON QUERIES
-- ============================================================================

-- View for credit balance summary
CREATE OR REPLACE VIEW credit_balance_summary AS
SELECT
    pc.firebase_uid,
    pc.total_credits,
    COUNT(cp.id) as purchase_count,
    COALESCE(SUM(cp.credits_remaining), 0) as credits_available,
    MIN(cp.expires_at) as next_expiry
FROM parent_credits pc
LEFT JOIN credit_purchases cp ON pc.firebase_uid = cp.firebase_uid AND cp.status = 'active'
GROUP BY pc.firebase_uid, pc.total_credits;

-- View for upcoming bookings
CREATE OR REPLACE VIEW upcoming_bookings_view AS
SELECT
    sb.*,
    r.form_data->>'player_name' as player_name,
    r.form_data->>'player_category' as player_category
FROM session_bookings sb
JOIN registrations r ON sb.registration_id = r.id
WHERE sb.session_date >= CURRENT_DATE
  AND sb.status = 'booked'
ORDER BY sb.session_date, sb.time_slot;

-- View for recent credit activity
CREATE OR REPLACE VIEW recent_credit_activity AS
SELECT
    'purchase' as activity_type,
    cp.firebase_uid,
    cp.credits_purchased as amount,
    cp.package_type,
    cp.created_at,
    NULL as admin_email,
    NULL as reason
FROM credit_purchases cp
WHERE cp.status = 'active'

UNION ALL

SELECT
    'adjustment' as activity_type,
    ca.firebase_uid,
    ca.adjustment_amount as amount,
    NULL as package_type,
    ca.created_at,
    ca.admin_email,
    ca.reason
FROM credit_adjustments ca

ORDER BY created_at DESC
LIMIT 100;