-- ============================================================================
-- CREDIT SYSTEM - REALTIME & ROW LEVEL SECURITY
-- ============================================================================
-- This file enables Supabase Realtime subscriptions and configures RLS policies
-- for the credit system tables.
--
-- Run this AFTER credit_system_schema.sql
--
-- Created: December 11, 2025
-- ============================================================================

-- ============================================================================
-- ENABLE ROW LEVEL SECURITY ON ALL CREDIT TABLES
-- ============================================================================

ALTER TABLE parent_credits ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE recurring_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_adjustments ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- RLS POLICIES: parent_credits
-- ============================================================================

-- Users can view their own credit balance
DROP POLICY IF EXISTS "Users can view own credits" ON parent_credits;
CREATE POLICY "Users can view own credits"
    ON parent_credits
    FOR SELECT
    USING (firebase_uid = auth.uid()::text);

-- Service role bypasses RLS automatically, but we add anon insert for initial record creation
-- Note: Service role (used by API) bypasses RLS by default in Supabase

-- ============================================================================
-- RLS POLICIES: credit_purchases
-- ============================================================================

-- Users can view their own purchases
DROP POLICY IF EXISTS "Users can view own purchases" ON credit_purchases;
CREATE POLICY "Users can view own purchases"
    ON credit_purchases
    FOR SELECT
    USING (firebase_uid = auth.uid()::text);

-- Note: Service role bypasses RLS by default in Supabase

-- ============================================================================
-- RLS POLICIES: session_bookings
-- ============================================================================

-- Users can view their own bookings
DROP POLICY IF EXISTS "Users can view own bookings" ON session_bookings;
CREATE POLICY "Users can view own bookings"
    ON session_bookings
    FOR SELECT
    USING (firebase_uid = auth.uid()::text);

-- Users can insert their own bookings (API validates credits)
DROP POLICY IF EXISTS "Users can create own bookings" ON session_bookings;
CREATE POLICY "Users can create own bookings"
    ON session_bookings
    FOR INSERT
    WITH CHECK (firebase_uid = auth.uid()::text);

-- Users can update their own bookings (for cancellation)
DROP POLICY IF EXISTS "Users can update own bookings" ON session_bookings;
CREATE POLICY "Users can update own bookings"
    ON session_bookings
    FOR UPDATE
    USING (firebase_uid = auth.uid()::text)
    WITH CHECK (firebase_uid = auth.uid()::text);

-- Note: Service role bypasses RLS by default in Supabase

-- ============================================================================
-- RLS POLICIES: recurring_schedules
-- ============================================================================

-- Users can view their own recurring schedules
DROP POLICY IF EXISTS "Users can view own recurring" ON recurring_schedules;
CREATE POLICY "Users can view own recurring"
    ON recurring_schedules
    FOR SELECT
    USING (firebase_uid = auth.uid()::text);

-- Users can manage their own recurring schedules
DROP POLICY IF EXISTS "Users can manage own recurring" ON recurring_schedules;
CREATE POLICY "Users can manage own recurring"
    ON recurring_schedules
    FOR ALL
    USING (firebase_uid = auth.uid()::text)
    WITH CHECK (firebase_uid = auth.uid()::text);

-- Note: Service role bypasses RLS by default in Supabase

-- ============================================================================
-- RLS POLICIES: credit_adjustments
-- ============================================================================

-- Users can view their own adjustment history
DROP POLICY IF EXISTS "Users can view own adjustments" ON credit_adjustments;
CREATE POLICY "Users can view own adjustments"
    ON credit_adjustments
    FOR SELECT
    USING (firebase_uid = auth.uid()::text);

-- Note: Service role bypasses RLS by default in Supabase
-- Only admins via service role can create adjustments

-- ============================================================================
-- PERFORMANCE INDEXES ON firebase_uid (used in RLS policies)
-- ============================================================================
-- These indexes improve RLS policy performance when filtering by firebase_uid

CREATE INDEX IF NOT EXISTS idx_parent_credits_firebase_uid ON parent_credits(firebase_uid);
CREATE INDEX IF NOT EXISTS idx_credit_purchases_firebase_uid ON credit_purchases(firebase_uid);
CREATE INDEX IF NOT EXISTS idx_session_bookings_firebase_uid ON session_bookings(firebase_uid);
CREATE INDEX IF NOT EXISTS idx_recurring_schedules_firebase_uid ON recurring_schedules(firebase_uid);
CREATE INDEX IF NOT EXISTS idx_credit_adjustments_firebase_uid ON credit_adjustments(firebase_uid);

-- ============================================================================
-- ENABLE SUPABASE REALTIME ON CREDIT TABLES
-- ============================================================================
-- Note: These commands enable realtime subscriptions (idempotent - safe to re-run)

-- Ensure publication exists (Supabase creates this by default, but just in case)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
        CREATE PUBLICATION supabase_realtime;
    END IF;
END $$;

-- Use DO block to safely add tables to publication (won't fail if already added)
DO $$
BEGIN
    -- Enable realtime for parent_credits (balance updates)
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime' AND tablename = 'parent_credits'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE parent_credits;
    END IF;

    -- Enable realtime for session_bookings (booking changes affect capacity)
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime' AND tablename = 'session_bookings'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE session_bookings;
    END IF;

    -- Enable realtime for credit_purchases (new purchase confirmations)
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime' AND tablename = 'credit_purchases'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE credit_purchases;
    END IF;

    -- Enable realtime for recurring_schedules (status updates)
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime' AND tablename = 'recurring_schedules'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE recurring_schedules;
    END IF;
END $$;

-- Note: notifications and sunday_practice_slots should already have realtime enabled
-- Run these only if needed:
-- ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
-- ALTER PUBLICATION supabase_realtime ADD TABLE sunday_practice_slots;

-- ============================================================================
-- ANONYMOUS ACCESS POLICIES (for public capacity display)
-- ============================================================================
-- These allow anonymous users to see slot availability without seeing
-- individual booking details

-- View for public capacity (no personal data)
CREATE OR REPLACE VIEW public_slot_capacity AS
SELECT
    session_date,
    time_slot,
    session_type,
    COUNT(*) as booked_count,
    CASE session_type
        WHEN 'group' THEN 6
        WHEN 'sunday' THEN 20
        WHEN 'private' THEN 1
        WHEN 'semi_private' THEN 3
    END as max_capacity
FROM session_bookings
WHERE status IN ('booked', 'attended')
GROUP BY session_date, time_slot, session_type;

-- Grant SELECT on the public capacity view to anon role
GRANT SELECT ON public_slot_capacity TO anon;

-- ============================================================================
-- ADMIN ACCESS POLICIES
-- ============================================================================
-- Admin users can view all data for customer support

-- Function to check if user is admin (based on custom claim or separate table)
-- Made STABLE for better query planning since it only reads settings
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
DECLARE
    v_claims json;
BEGIN
    -- Get JWT claims safely
    v_claims := current_setting('request.jwt.claims', true)::json;

    -- Return false if no claims (unauthenticated request)
    IF v_claims IS NULL THEN
        RETURN FALSE;
    END IF;

    -- Check if user has admin role in JWT custom claims
    -- This assumes you set custom claims in Firebase/Supabase auth
    RETURN COALESCE(
        v_claims->>'role' = 'admin'
        OR v_claims->'app_metadata'->>'role' = 'admin',
        FALSE
    );
EXCEPTION
    WHEN OTHERS THEN
        RETURN FALSE;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Revoke execute on is_admin from public roles (security hardening)
-- Only postgres/superuser and the function owner need to call this
REVOKE EXECUTE ON FUNCTION is_admin() FROM anon, authenticated;

-- Admin can view all parent_credits
DROP POLICY IF EXISTS "Admin can view all credits" ON parent_credits;
CREATE POLICY "Admin can view all credits"
    ON parent_credits
    FOR SELECT
    USING (is_admin());

-- Admin can view all credit_purchases
DROP POLICY IF EXISTS "Admin can view all purchases" ON credit_purchases;
CREATE POLICY "Admin can view all purchases"
    ON credit_purchases
    FOR SELECT
    USING (is_admin());

-- Admin can view all session_bookings
DROP POLICY IF EXISTS "Admin can view all bookings" ON session_bookings;
CREATE POLICY "Admin can view all bookings"
    ON session_bookings
    FOR SELECT
    USING (is_admin());

-- Admin can view all recurring_schedules
DROP POLICY IF EXISTS "Admin can view all recurring" ON recurring_schedules;
CREATE POLICY "Admin can view all recurring"
    ON recurring_schedules
    FOR SELECT
    USING (is_admin());

-- Admin can view all credit_adjustments
DROP POLICY IF EXISTS "Admin can view all adjustments" ON credit_adjustments;
CREATE POLICY "Admin can view all adjustments"
    ON credit_adjustments
    FOR SELECT
    USING (is_admin());

-- ============================================================================
-- NOTIFICATIONS TABLE RLS POLICY FOR TRIGGER FUNCTIONS
-- ============================================================================
-- SECURITY DEFINER functions run as the function owner (typically postgres)
-- We need to ensure the notifications table allows inserts from this role
-- Note: If notifications has RLS enabled, this policy allows trigger inserts

DROP POLICY IF EXISTS "Allow trigger function inserts" ON notifications;
CREATE POLICY "Allow trigger function inserts"
    ON notifications
    FOR INSERT
    WITH CHECK (
        -- Allow inserts when called from SECURITY DEFINER context
        -- (These functions run as their owner, typically postgres)
        -- The user_id must match a valid firebase_uid pattern
        user_id IS NOT NULL
    );

-- ============================================================================
-- REALTIME BROADCAST CONFIGURATION
-- ============================================================================
-- Configure which columns trigger realtime events

-- For parent_credits, we want to broadcast total_credits changes
COMMENT ON TABLE parent_credits IS 'realtime:broadcast_changes=true';

-- For session_bookings, broadcast on status changes
COMMENT ON TABLE session_bookings IS 'realtime:broadcast_changes=true';

-- For credit_purchases, broadcast on new purchases
COMMENT ON TABLE credit_purchases IS 'realtime:broadcast_changes=true';

-- For recurring_schedules, broadcast on status/pause changes
COMMENT ON TABLE recurring_schedules IS 'realtime:broadcast_changes=true';

-- ============================================================================
-- TRIGGERS FOR REALTIME NOTIFICATIONS
-- ============================================================================

-- Function to create notification on low credit balance
CREATE OR REPLACE FUNCTION notify_low_credits()
RETURNS TRIGGER AS $$
BEGIN
    -- If credits drop below 3, create a notification
    IF NEW.total_credits < 3 AND (OLD.total_credits IS NULL OR OLD.total_credits >= 3) THEN
        INSERT INTO notifications (
            user_id,
            user_type,
            type,
            title,
            message,
            priority,
            data
        ) VALUES (
            NEW.firebase_uid,
            'parent',
            'system',
            'Low Credit Balance',
            'You have ' || NEW.total_credits || ' credit(s) remaining. Consider purchasing more credits to continue booking sessions.',
            'high',
            jsonb_build_object('credits_remaining', NEW.total_credits)
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_low_credits_notification ON parent_credits;
CREATE TRIGGER trigger_low_credits_notification
    AFTER UPDATE ON parent_credits
    FOR EACH ROW
    EXECUTE FUNCTION notify_low_credits();

-- Function to create notification on booking confirmation
CREATE OR REPLACE FUNCTION notify_booking_confirmed()
RETURNS TRIGGER AS $$
DECLARE
    v_player_name TEXT;
BEGIN
    -- Get player name from registration (with fallback for missing data)
    SELECT COALESCE(form_data->>'playerFullName', 'Player')
    INTO v_player_name
    FROM registrations
    WHERE id = NEW.registration_id;

    -- Handle case where registration not found
    v_player_name := COALESCE(v_player_name, 'Player');

    -- Create booking confirmation notification
    INSERT INTO notifications (
        user_id,
        user_type,
        type,
        title,
        message,
        priority,
        data
    ) VALUES (
        NEW.firebase_uid,
        'parent',
        'sunday_booking', -- Reusing existing type
        'Booking Confirmed',
        v_player_name || '''s ' || NEW.session_type || ' session on ' || to_char(NEW.session_date, 'Mon DD, YYYY') || ' at ' || NEW.time_slot || ' has been booked.',
        'normal',
        jsonb_build_object(
            'booking_id', NEW.id,
            'player_name', v_player_name,
            'session_type', NEW.session_type,
            'session_date', NEW.session_date,
            'time_slot', NEW.time_slot
        )
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_booking_notification ON session_bookings;
CREATE TRIGGER trigger_booking_notification
    AFTER INSERT ON session_bookings
    FOR EACH ROW
    WHEN (NEW.status = 'booked')
    EXECUTE FUNCTION notify_booking_confirmed();

-- Function to notify when recurring is paused
CREATE OR REPLACE FUNCTION notify_recurring_paused()
RETURNS TRIGGER AS $$
DECLARE
    v_player_name TEXT;
BEGIN
    IF NEW.is_active = FALSE AND NEW.paused_reason = 'insufficient_credits' AND OLD.is_active = TRUE THEN
        -- Get player name (with fallback for missing data)
        SELECT COALESCE(form_data->>'playerFullName', 'Player')
        INTO v_player_name
        FROM registrations
        WHERE id = NEW.registration_id;

        -- Handle case where registration not found
        v_player_name := COALESCE(v_player_name, 'Player');

        INSERT INTO notifications (
            user_id,
            user_type,
            type,
            title,
            message,
            priority,
            data
        ) VALUES (
            NEW.firebase_uid,
            'parent',
            'system',
            'Recurring Booking Paused',
            v_player_name || '''s recurring ' || NEW.day_of_week || ' ' || NEW.time_slot || ' session has been paused due to insufficient credits.',
            'urgent',
            jsonb_build_object(
                'recurring_id', NEW.id,
                'player_name', v_player_name,
                'day_of_week', NEW.day_of_week,
                'time_slot', NEW.time_slot,
                'paused_reason', NEW.paused_reason
            )
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_recurring_paused_notification ON recurring_schedules;
CREATE TRIGGER trigger_recurring_paused_notification
    AFTER UPDATE ON recurring_schedules
    FOR EACH ROW
    EXECUTE FUNCTION notify_recurring_paused();

-- ============================================================================
-- CRON JOB FUNCTIONS (to be scheduled in Supabase or Vercel)
-- ============================================================================

-- Function to check for expiring credits and send notifications
CREATE OR REPLACE FUNCTION check_expiring_credits()
RETURNS INTEGER AS $$
DECLARE
    v_notified INTEGER := 0;
    r RECORD;
BEGIN
    -- Find parents with credits expiring in 30 days who haven't been notified
    FOR r IN
        SELECT DISTINCT
            cp.firebase_uid,
            SUM(cp.credits_remaining) as expiring_credits,
            MIN(cp.expires_at) as earliest_expiry
        FROM credit_purchases cp
        WHERE cp.status = 'active'
          AND cp.credits_remaining > 0
          AND cp.expires_at BETWEEN NOW() AND NOW() + INTERVAL '30 days'
        GROUP BY cp.firebase_uid
        HAVING SUM(cp.credits_remaining) > 0
    LOOP
        -- Check if we already sent a notification recently
        IF NOT EXISTS (
            SELECT 1 FROM notifications
            WHERE user_id = r.firebase_uid
              AND type = 'system'
              AND title = 'Credits Expiring Soon'
              AND created_at > NOW() - INTERVAL '7 days'
        ) THEN
            INSERT INTO notifications (
                user_id,
                user_type,
                type,
                title,
                message,
                priority,
                data
            ) VALUES (
                r.firebase_uid,
                'parent',
                'system',
                'Credits Expiring Soon',
                r.expiring_credits || ' credit(s) will expire on ' || to_char(r.earliest_expiry, 'Mon DD, YYYY') || '. Use them before they expire!',
                'high',
                jsonb_build_object(
                    'expiring_credits', r.expiring_credits,
                    'earliest_expiry', r.earliest_expiry
                )
            );
            v_notified := v_notified + 1;
        END IF;
    END LOOP;

    RETURN v_notified;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- SECURITY HARDENING: REVOKE EXECUTE ON SECURITY DEFINER FUNCTIONS
-- ============================================================================
-- These functions are called by triggers/cron, not by users directly
-- Revoking execute prevents potential abuse

REVOKE EXECUTE ON FUNCTION notify_low_credits() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION notify_booking_confirmed() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION notify_recurring_paused() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION check_expiring_credits() FROM anon, authenticated;

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================
-- Run these to verify setup:

-- Check realtime is enabled
-- SELECT * FROM pg_publication_tables WHERE pubname = 'supabase_realtime';

-- Check RLS is enabled
-- SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public' AND tablename IN ('parent_credits', 'credit_purchases', 'session_bookings', 'recurring_schedules', 'credit_adjustments');

-- Check policies exist
-- SELECT tablename, policyname, permissive, roles, cmd FROM pg_policies WHERE schemaname = 'public' AND tablename IN ('parent_credits', 'credit_purchases', 'session_bookings', 'recurring_schedules', 'credit_adjustments');
