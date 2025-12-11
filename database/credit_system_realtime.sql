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

-- Service role can do everything (for API operations)
DROP POLICY IF EXISTS "Service role full access to parent_credits" ON parent_credits;
CREATE POLICY "Service role full access to parent_credits"
    ON parent_credits
    FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

-- ============================================================================
-- RLS POLICIES: credit_purchases
-- ============================================================================

-- Users can view their own purchases
DROP POLICY IF EXISTS "Users can view own purchases" ON credit_purchases;
CREATE POLICY "Users can view own purchases"
    ON credit_purchases
    FOR SELECT
    USING (firebase_uid = auth.uid()::text);

-- Service role can do everything
DROP POLICY IF EXISTS "Service role full access to credit_purchases" ON credit_purchases;
CREATE POLICY "Service role full access to credit_purchases"
    ON credit_purchases
    FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

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

-- Service role can do everything
DROP POLICY IF EXISTS "Service role full access to session_bookings" ON session_bookings;
CREATE POLICY "Service role full access to session_bookings"
    ON session_bookings
    FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

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

-- Service role can do everything
DROP POLICY IF EXISTS "Service role full access to recurring_schedules" ON recurring_schedules;
CREATE POLICY "Service role full access to recurring_schedules"
    ON recurring_schedules
    FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

-- ============================================================================
-- RLS POLICIES: credit_adjustments
-- ============================================================================

-- Users can view their own adjustment history
DROP POLICY IF EXISTS "Users can view own adjustments" ON credit_adjustments;
CREATE POLICY "Users can view own adjustments"
    ON credit_adjustments
    FOR SELECT
    USING (firebase_uid = auth.uid()::text);

-- Only service role can create adjustments (admin only)
DROP POLICY IF EXISTS "Service role full access to credit_adjustments" ON credit_adjustments;
CREATE POLICY "Service role full access to credit_adjustments"
    ON credit_adjustments
    FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

-- ============================================================================
-- ENABLE SUPABASE REALTIME ON CREDIT TABLES
-- ============================================================================
-- Note: Run these commands to enable realtime subscriptions

-- Enable realtime for parent_credits (balance updates)
ALTER PUBLICATION supabase_realtime ADD TABLE parent_credits;

-- Enable realtime for session_bookings (booking changes affect capacity)
ALTER PUBLICATION supabase_realtime ADD TABLE session_bookings;

-- Enable realtime for credit_purchases (new purchase confirmations)
ALTER PUBLICATION supabase_realtime ADD TABLE credit_purchases;

-- Enable realtime for recurring_schedules (status updates)
ALTER PUBLICATION supabase_realtime ADD TABLE recurring_schedules;

-- Verify notifications already has realtime (if not, uncomment)
-- ALTER PUBLICATION supabase_realtime ADD TABLE notifications;

-- Verify sunday_practice_slots already has realtime (if not, uncomment)
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
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
    -- Check if user has admin role in JWT custom claims
    -- This assumes you set custom claims in Firebase/Supabase auth
    RETURN (
        current_setting('request.jwt.claims', true)::json->>'role' = 'admin'
        OR current_setting('request.jwt.claims', true)::json->'app_metadata'->>'role' = 'admin'
    );
EXCEPTION
    WHEN OTHERS THEN
        RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

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
    -- Get player name from registration
    SELECT form_data->>'playerFullName'
    INTO v_player_name
    FROM registrations
    WHERE id = NEW.registration_id;

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
        -- Get player name
        SELECT form_data->>'playerFullName'
        INTO v_player_name
        FROM registrations
        WHERE id = NEW.registration_id;

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
-- VERIFICATION QUERIES
-- ============================================================================
-- Run these to verify setup:

-- Check realtime is enabled
-- SELECT * FROM pg_publication_tables WHERE pubname = 'supabase_realtime';

-- Check RLS is enabled
-- SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public' AND tablename IN ('parent_credits', 'credit_purchases', 'session_bookings', 'recurring_schedules', 'credit_adjustments');

-- Check policies exist
-- SELECT tablename, policyname, permissive, roles, cmd FROM pg_policies WHERE schemaname = 'public' AND tablename IN ('parent_credits', 'credit_purchases', 'session_bookings', 'recurring_schedules', 'credit_adjustments');
