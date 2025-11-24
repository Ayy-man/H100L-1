-- ============================================================
-- RESCHEDULING SYSTEM DATABASE SCHEMA
-- ============================================================
-- Complete schema for tracking schedule changes across all program types
-- (Group, Private, Semi-Private)
--
-- Tables:
--   1. schedule_changes - All schedule modifications (one-time and permanent)
--   2. schedule_exceptions - One-time skip/swap for specific dates
--   3. semi_private_pairings - Current and historical pairing records
--   4. unpaired_semi_private - Players waiting for a partner
--
-- Functions:
--   - Various validation and helper functions for rescheduling operations
-- ============================================================

-- ============================================================
-- TABLE 1: schedule_changes
-- ============================================================
-- Tracks all schedule modifications (one-time and permanent)

DROP TABLE IF EXISTS public.schedule_changes CASCADE;

CREATE TABLE public.schedule_changes (
  -- Primary key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Foreign keys
  registration_id UUID NOT NULL REFERENCES public.registrations(id) ON DELETE CASCADE,

  -- Change details
  change_type TEXT NOT NULL CHECK (change_type IN ('one_time', 'permanent')),
  program_type TEXT NOT NULL CHECK (program_type IN ('group', 'private', 'semi_private')),

  -- Original schedule
  original_days TEXT[], -- e.g., ['monday', 'wednesday']
  original_time TEXT, -- e.g., '4:30 PM' or '9:00 AM'

  -- New schedule
  new_days TEXT[], -- e.g., ['tuesday', 'thursday']
  new_time TEXT, -- e.g., '5:45 PM' or '10:00 AM'

  -- Dates
  effective_date DATE, -- For permanent changes: when it takes effect
  specific_date DATE, -- For one-time changes: the specific date being modified

  -- Status tracking
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'applied', 'cancelled', 'rejected')),

  -- Optional metadata
  reason TEXT, -- Parent's reason for the change
  admin_notes TEXT, -- Admin notes or rejection reason

  -- Audit fields
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by TEXT, -- 'parent' or 'admin' or firebase_uid
  approved_at TIMESTAMP WITH TIME ZONE,
  approved_by TEXT, -- firebase_uid of admin
  applied_at TIMESTAMP WITH TIME ZONE,
  cancelled_at TIMESTAMP WITH TIME ZONE,

  -- Metadata
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_schedule_changes_registration ON public.schedule_changes(registration_id);
CREATE INDEX idx_schedule_changes_status ON public.schedule_changes(status);
CREATE INDEX idx_schedule_changes_type ON public.schedule_changes(change_type);
CREATE INDEX idx_schedule_changes_program ON public.schedule_changes(program_type);
CREATE INDEX idx_schedule_changes_effective_date ON public.schedule_changes(effective_date);

COMMENT ON TABLE public.schedule_changes IS 'Tracks all schedule modifications (one-time and permanent) for all program types';

-- ============================================================
-- TABLE 2: schedule_exceptions
-- ============================================================
-- Tracks one-time skip/swap for specific dates

DROP TABLE IF EXISTS public.schedule_exceptions CASCADE;

CREATE TABLE public.schedule_exceptions (
  -- Primary key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Foreign keys
  registration_id UUID NOT NULL REFERENCES public.registrations(id) ON DELETE CASCADE,

  -- Exception details
  exception_date DATE NOT NULL, -- The date being modified
  exception_type TEXT NOT NULL CHECK (exception_type IN ('skip', 'swap')),

  -- Replacement details (for swap type)
  replacement_date DATE, -- The new date (if swap)
  replacement_time TEXT, -- The new time (if applicable)
  replacement_day TEXT, -- e.g., 'monday', 'tuesday'

  -- Status
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'applied', 'cancelled')),

  -- Reason
  reason TEXT,

  -- Audit fields
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by TEXT, -- firebase_uid
  applied_at TIMESTAMP WITH TIME ZONE,
  cancelled_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_schedule_exceptions_registration ON public.schedule_exceptions(registration_id);
CREATE INDEX idx_schedule_exceptions_date ON public.schedule_exceptions(exception_date);
CREATE INDEX idx_schedule_exceptions_status ON public.schedule_exceptions(status);

COMMENT ON TABLE public.schedule_exceptions IS 'Tracks one-time skip/swap for specific dates';

-- ============================================================
-- TABLE 3: semi_private_pairings
-- ============================================================
-- Tracks current and historical semi-private pairings

DROP TABLE IF EXISTS public.semi_private_pairings CASCADE;

CREATE TABLE public.semi_private_pairings (
  -- Primary key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Player registrations
  player_1_registration_id UUID NOT NULL REFERENCES public.registrations(id) ON DELETE CASCADE,
  player_2_registration_id UUID NOT NULL REFERENCES public.registrations(id) ON DELETE CASCADE,

  -- Schedule
  scheduled_day TEXT NOT NULL, -- e.g., 'monday'
  scheduled_time TEXT NOT NULL, -- e.g., '9:00 AM' (hourly slot start time)

  -- Status
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'dissolved', 'pending')),

  -- Dates
  paired_date DATE NOT NULL DEFAULT CURRENT_DATE,
  dissolved_date DATE,

  -- Dissolution details
  dissolved_reason TEXT,
  dissolved_by TEXT, -- firebase_uid or 'system'

  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Constraints
  CONSTRAINT different_players CHECK (player_1_registration_id != player_2_registration_id),
  CONSTRAINT valid_dissolution CHECK (
    (status = 'dissolved' AND dissolved_date IS NOT NULL) OR
    (status != 'dissolved' AND dissolved_date IS NULL)
  )
);

-- Indexes
CREATE INDEX idx_semi_private_pairings_player1 ON public.semi_private_pairings(player_1_registration_id);
CREATE INDEX idx_semi_private_pairings_player2 ON public.semi_private_pairings(player_2_registration_id);
CREATE INDEX idx_semi_private_pairings_status ON public.semi_private_pairings(status);
CREATE INDEX idx_semi_private_pairings_schedule ON public.semi_private_pairings(scheduled_day, scheduled_time) WHERE status = 'active';

COMMENT ON TABLE public.semi_private_pairings IS 'Tracks current and historical semi-private player pairings';

-- ============================================================
-- TABLE 4: unpaired_semi_private
-- ============================================================
-- Tracks players waiting for a partner

DROP TABLE IF EXISTS public.unpaired_semi_private CASCADE;

CREATE TABLE public.unpaired_semi_private (
  -- Primary key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Foreign keys
  registration_id UUID NOT NULL UNIQUE REFERENCES public.registrations(id) ON DELETE CASCADE,

  -- Player details (denormalized for quick access)
  player_name TEXT NOT NULL,
  player_category TEXT NOT NULL,
  age_category TEXT NOT NULL, -- e.g., 'M11', 'M13'

  -- Preferences
  preferred_days TEXT[], -- e.g., ['monday', 'wednesday', 'thursday']
  preferred_time_slots TEXT[], -- e.g., ['9:00 AM', '10:00 AM', '1:00 PM']

  -- Status
  status TEXT NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'paired', 'inactive')),

  -- Dates
  unpaired_since_date DATE NOT NULL DEFAULT CURRENT_DATE,
  paired_date DATE,

  -- Contact info (denormalized)
  parent_email TEXT NOT NULL,
  parent_name TEXT NOT NULL,

  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_unpaired_semi_private_status ON public.unpaired_semi_private(status);
CREATE INDEX idx_unpaired_semi_private_category ON public.unpaired_semi_private(age_category) WHERE status = 'waiting';
CREATE INDEX idx_unpaired_semi_private_days ON public.unpaired_semi_private USING GIN(preferred_days) WHERE status = 'waiting';
CREATE INDEX idx_unpaired_semi_private_times ON public.unpaired_semi_private USING GIN(preferred_time_slots) WHERE status = 'waiting';

COMMENT ON TABLE public.unpaired_semi_private IS 'Tracks semi-private players waiting for a partner';

-- ============================================================
-- HELPER FUNCTIONS
-- ============================================================

-- Function to check if a day change is valid (has capacity)
CREATE OR REPLACE FUNCTION check_group_day_capacity(
  p_day TEXT,
  p_player_category TEXT
)
RETURNS BOOLEAN AS $$
DECLARE
  v_max_capacity INTEGER := 6;
  v_current_bookings INTEGER;
BEGIN
  -- Count current bookings for this day and category's time slot
  SELECT COUNT(*)
  INTO v_current_bookings
  FROM public.registrations
  WHERE payment_status = 'active'
    AND form_data->>'programType' = 'group'
    AND form_data->>'groupSelectedDays' ? p_day;

  RETURN v_current_bookings < v_max_capacity;
END;
$$ LANGUAGE plpgsql;

-- Function to find suggested times for semi-private (where unpaired players exist)
CREATE OR REPLACE FUNCTION get_suggested_semi_private_times(
  p_registration_id UUID,
  p_player_category TEXT
)
RETURNS JSON AS $$
DECLARE
  v_suggestions JSON;
BEGIN
  -- Find unpaired players in same age category with overlapping availability
  SELECT json_agg(
    json_build_object(
      'day', unnest(u.preferred_days),
      'time', unnest(u.preferred_time_slots),
      'partner_name', u.player_name,
      'partner_category', u.age_category
    )
  )
  INTO v_suggestions
  FROM public.unpaired_semi_private u
  WHERE u.age_category = p_player_category
    AND u.status = 'waiting'
    AND u.registration_id != p_registration_id;

  RETURN COALESCE(v_suggestions, '[]'::json);
END;
$$ LANGUAGE plpgsql;

-- Function to auto-pair semi-private players when they choose the same slot
CREATE OR REPLACE FUNCTION auto_pair_semi_private(
  p_registration_id UUID,
  p_day TEXT,
  p_time TEXT
)
RETURNS JSON AS $$
DECLARE
  v_unpaired_player_id UUID;
  v_pairing_id UUID;
  v_player_category TEXT;
BEGIN
  -- Get the player's category
  SELECT form_data->>'playerCategory'
  INTO v_player_category
  FROM public.registrations
  WHERE id = p_registration_id;

  -- Find an unpaired player in same category with this day/time preference
  SELECT registration_id
  INTO v_unpaired_player_id
  FROM public.unpaired_semi_private
  WHERE age_category = v_player_category
    AND status = 'waiting'
    AND p_day = ANY(preferred_days)
    AND p_time = ANY(preferred_time_slots)
    AND registration_id != p_registration_id
  LIMIT 1;

  IF v_unpaired_player_id IS NOT NULL THEN
    -- Create pairing
    INSERT INTO public.semi_private_pairings (
      player_1_registration_id,
      player_2_registration_id,
      scheduled_day,
      scheduled_time,
      status
    ) VALUES (
      p_registration_id,
      v_unpaired_player_id,
      p_day,
      p_time,
      'active'
    )
    RETURNING id INTO v_pairing_id;

    -- Update unpaired status
    UPDATE public.unpaired_semi_private
    SET status = 'paired', paired_date = CURRENT_DATE, updated_at = NOW()
    WHERE registration_id IN (p_registration_id, v_unpaired_player_id);

    RETURN json_build_object(
      'success', true,
      'paired', true,
      'pairing_id', v_pairing_id,
      'partner_id', v_unpaired_player_id
    );
  ELSE
    -- No pairing found, add to unpaired list
    INSERT INTO public.unpaired_semi_private (
      registration_id,
      player_name,
      player_category,
      age_category,
      preferred_days,
      preferred_time_slots,
      parent_email,
      parent_name,
      status
    )
    SELECT
      p_registration_id,
      form_data->>'playerFullName',
      form_data->>'playerCategory',
      form_data->>'playerCategory',
      ARRAY[p_day],
      ARRAY[p_time],
      form_data->>'parentEmail',
      form_data->>'parentFullName',
      'waiting'
    FROM public.registrations
    WHERE id = p_registration_id
    ON CONFLICT (registration_id) DO UPDATE
    SET
      preferred_days = ARRAY[p_day],
      preferred_time_slots = ARRAY[p_time],
      status = 'waiting',
      updated_at = NOW();

    RETURN json_build_object(
      'success', true,
      'paired', false,
      'waiting', true
    );
  END IF;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================

-- Enable RLS on all tables
ALTER TABLE public.schedule_changes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schedule_exceptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.semi_private_pairings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.unpaired_semi_private ENABLE ROW LEVEL SECURITY;

-- Policies for schedule_changes: Users can view/create their own
CREATE POLICY "Users can view own schedule changes"
  ON public.schedule_changes
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.registrations
      WHERE registrations.id = schedule_changes.registration_id
        AND registrations.firebase_uid = auth.uid()::text
    )
  );

CREATE POLICY "Users can create own schedule changes"
  ON public.schedule_changes
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.registrations
      WHERE registrations.id = schedule_changes.registration_id
        AND registrations.firebase_uid = auth.uid()::text
    )
  );

-- Policies for schedule_exceptions: Users can view/create their own
CREATE POLICY "Users can view own schedule exceptions"
  ON public.schedule_exceptions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.registrations
      WHERE registrations.id = schedule_exceptions.registration_id
        AND registrations.firebase_uid = auth.uid()::text
    )
  );

CREATE POLICY "Users can create own schedule exceptions"
  ON public.schedule_exceptions
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.registrations
      WHERE registrations.id = schedule_exceptions.registration_id
        AND registrations.firebase_uid = auth.uid()::text
    )
  );

-- Policies for semi_private_pairings: Users can view pairings they're part of
CREATE POLICY "Users can view own pairings"
  ON public.semi_private_pairings
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.registrations
      WHERE registrations.id IN (
        semi_private_pairings.player_1_registration_id,
        semi_private_pairings.player_2_registration_id
      )
      AND registrations.firebase_uid = auth.uid()::text
    )
  );

-- Policies for unpaired_semi_private: Users can view their own unpaired status
CREATE POLICY "Users can view own unpaired status"
  ON public.unpaired_semi_private
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.registrations
      WHERE registrations.id = unpaired_semi_private.registration_id
        AND registrations.firebase_uid = auth.uid()::text
    )
  );

-- Service role has full access to all tables
CREATE POLICY "Service role full access schedule_changes"
  ON public.schedule_changes
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Service role full access schedule_exceptions"
  ON public.schedule_exceptions
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Service role full access semi_private_pairings"
  ON public.semi_private_pairings
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Service role full access unpaired_semi_private"
  ON public.unpaired_semi_private
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ============================================================
-- GRANT PERMISSIONS
-- ============================================================

GRANT SELECT, INSERT ON public.schedule_changes TO authenticated;
GRANT SELECT, INSERT ON public.schedule_exceptions TO authenticated;
GRANT SELECT ON public.semi_private_pairings TO authenticated;
GRANT SELECT ON public.unpaired_semi_private TO authenticated;

GRANT EXECUTE ON FUNCTION check_group_day_capacity TO authenticated;
GRANT EXECUTE ON FUNCTION get_suggested_semi_private_times TO authenticated;
GRANT EXECUTE ON FUNCTION auto_pair_semi_private TO authenticated;

-- ============================================================
-- VERIFICATION QUERIES
-- ============================================================

-- Check that tables were created
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('schedule_changes', 'schedule_exceptions', 'semi_private_pairings', 'unpaired_semi_private')
ORDER BY table_name;

-- Check functions
SELECT routine_name
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN ('check_group_day_capacity', 'get_suggested_semi_private_times', 'auto_pair_semi_private')
ORDER BY routine_name;
