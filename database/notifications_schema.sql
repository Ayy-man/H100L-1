-- ============================================================
-- NOTIFICATIONS SYSTEM DATABASE SCHEMA
-- ============================================================
-- Complete schema for app-wide notifications for both parents and admins
--
-- Features:
--   - In-app notifications with read/unread status
--   - Priority levels (low, normal, high, urgent)
--   - Notification types for various events
--   - Action URLs for quick navigation
--   - Optional expiration dates
--   - Support for both parent and admin notifications
-- ============================================================

-- ============================================================
-- TABLE: notifications
-- ============================================================
-- Stores all notifications for parents and admins

DROP TABLE IF EXISTS public.notifications CASCADE;

CREATE TABLE public.notifications (
  -- Primary key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- User identification
  user_id TEXT NOT NULL,              -- Firebase UID for parent, 'admin' for admin notifications
  user_type TEXT NOT NULL CHECK (user_type IN ('parent', 'admin')),

  -- Notification content
  type TEXT NOT NULL CHECK (type IN (
    'pairing_created',      -- Semi-private pairing was created
    'pairing_dissolved',    -- Semi-private pairing was dissolved
    'schedule_changed',     -- Schedule was changed (one-time or permanent)
    'payment_confirmed',    -- Payment was confirmed by admin
    'payment_received',     -- Stripe payment received
    'sunday_booking',       -- Sunday practice booked
    'sunday_reminder',      -- Sunday practice reminder
    'waitlist_update',      -- Waitlist status update
    'admin_message',        -- General admin message
    'system'                -- System notification
  )),
  title TEXT NOT NULL,
  message TEXT NOT NULL,

  -- Priority
  priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),

  -- Read status
  read BOOLEAN NOT NULL DEFAULT FALSE,
  read_at TIMESTAMP WITH TIME ZONE,

  -- Optional metadata
  data JSONB,                         -- Additional context (registration_id, player_name, etc.)
  action_url TEXT,                    -- Optional link to relevant page
  expires_at TIMESTAMP WITH TIME ZONE, -- Optional expiration date

  -- Audit fields
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================
-- INDEXES
-- ============================================================

-- Performance indexes for common queries
CREATE INDEX idx_notifications_user ON public.notifications(user_id, user_type);
CREATE INDEX idx_notifications_user_unread ON public.notifications(user_id, user_type, read) WHERE read = FALSE;
CREATE INDEX idx_notifications_type ON public.notifications(type);
CREATE INDEX idx_notifications_priority ON public.notifications(priority);
CREATE INDEX idx_notifications_created_at ON public.notifications(created_at DESC);
CREATE INDEX idx_notifications_expires_at ON public.notifications(expires_at) WHERE expires_at IS NOT NULL;

-- GIN index for JSONB data queries
CREATE INDEX idx_notifications_data ON public.notifications USING GIN(data);

COMMENT ON TABLE public.notifications IS 'Stores all in-app notifications for parents and admins';

-- ============================================================
-- HELPER FUNCTIONS
-- ============================================================

-- Function to create a notification
CREATE OR REPLACE FUNCTION create_notification(
  p_user_id TEXT,
  p_user_type TEXT,
  p_type TEXT,
  p_title TEXT,
  p_message TEXT,
  p_priority TEXT DEFAULT 'normal',
  p_data JSONB DEFAULT NULL,
  p_action_url TEXT DEFAULT NULL,
  p_expires_at TIMESTAMP WITH TIME ZONE DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_notification_id UUID;
BEGIN
  INSERT INTO public.notifications (
    user_id,
    user_type,
    type,
    title,
    message,
    priority,
    data,
    action_url,
    expires_at
  ) VALUES (
    p_user_id,
    p_user_type,
    p_type,
    p_title,
    p_message,
    p_priority,
    p_data,
    p_action_url,
    p_expires_at
  )
  RETURNING id INTO v_notification_id;

  RETURN v_notification_id;
END;
$$ LANGUAGE plpgsql;

-- Function to mark notification as read
CREATE OR REPLACE FUNCTION mark_notification_read(
  p_notification_id UUID,
  p_user_id TEXT
)
RETURNS BOOLEAN AS $$
DECLARE
  v_updated INTEGER;
BEGIN
  UPDATE public.notifications
  SET
    read = TRUE,
    read_at = NOW(),
    updated_at = NOW()
  WHERE id = p_notification_id
    AND user_id = p_user_id
    AND read = FALSE;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated > 0;
END;
$$ LANGUAGE plpgsql;

-- Function to mark all notifications as read for a user
CREATE OR REPLACE FUNCTION mark_all_notifications_read(
  p_user_id TEXT,
  p_user_type TEXT
)
RETURNS INTEGER AS $$
DECLARE
  v_updated INTEGER;
BEGIN
  UPDATE public.notifications
  SET
    read = TRUE,
    read_at = NOW(),
    updated_at = NOW()
  WHERE user_id = p_user_id
    AND user_type = p_user_type
    AND read = FALSE;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated;
END;
$$ LANGUAGE plpgsql;

-- Function to get unread notification count
CREATE OR REPLACE FUNCTION get_unread_notification_count(
  p_user_id TEXT,
  p_user_type TEXT
)
RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(*)
  INTO v_count
  FROM public.notifications
  WHERE user_id = p_user_id
    AND user_type = p_user_type
    AND read = FALSE
    AND (expires_at IS NULL OR expires_at > NOW());

  RETURN v_count;
END;
$$ LANGUAGE plpgsql;

-- Function to clean up expired notifications
CREATE OR REPLACE FUNCTION cleanup_expired_notifications()
RETURNS INTEGER AS $$
DECLARE
  v_deleted INTEGER;
BEGIN
  DELETE FROM public.notifications
  WHERE expires_at IS NOT NULL
    AND expires_at < NOW();

  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================

-- Enable RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own notifications
CREATE POLICY "Users can view own notifications"
  ON public.notifications
  FOR SELECT
  USING (
    user_id = auth.uid()::text
    OR user_type = 'admin'  -- Admin notifications visible to all admins
  );

-- Policy: Users can update their own notifications (mark as read)
CREATE POLICY "Users can update own notifications"
  ON public.notifications
  FOR UPDATE
  USING (user_id = auth.uid()::text)
  WITH CHECK (user_id = auth.uid()::text);

-- Policy: Service role has full access
CREATE POLICY "Service role full access notifications"
  ON public.notifications
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ============================================================
-- GRANT PERMISSIONS
-- ============================================================

GRANT SELECT, UPDATE ON public.notifications TO authenticated;
GRANT EXECUTE ON FUNCTION create_notification TO service_role;
GRANT EXECUTE ON FUNCTION mark_notification_read TO authenticated;
GRANT EXECUTE ON FUNCTION mark_all_notifications_read TO authenticated;
GRANT EXECUTE ON FUNCTION get_unread_notification_count TO authenticated;
GRANT EXECUTE ON FUNCTION cleanup_expired_notifications TO service_role;

-- ============================================================
-- VERIFICATION QUERIES
-- ============================================================

-- Check that table was created
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name = 'notifications';

-- Check functions
SELECT routine_name
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN (
    'create_notification',
    'mark_notification_read',
    'mark_all_notifications_read',
    'get_unread_notification_count',
    'cleanup_expired_notifications'
  )
ORDER BY routine_name;
