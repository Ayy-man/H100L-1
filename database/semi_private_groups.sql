-- Semi-Private Groups Management
-- This schema manages grouping of semi-private registrations

-- Table to store semi-private groups
CREATE TABLE IF NOT EXISTS public.semi_private_groups (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  group_name TEXT,
  status TEXT DEFAULT 'pending', -- pending, confirmed, active, completed
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  confirmed_at TIMESTAMP WITH TIME ZONE,
  scheduled_day TEXT, -- day of week
  scheduled_time TEXT, -- time slot
  coach_assigned TEXT,
  notes TEXT
);

-- Junction table linking registrations to groups
CREATE TABLE IF NOT EXISTS public.semi_private_group_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  group_id UUID REFERENCES public.semi_private_groups(id) ON DELETE CASCADE,
  registration_id UUID REFERENCES public.registrations(id) ON DELETE CASCADE,
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(registration_id) -- A registration can only be in one group
);

-- View: Unmatched Semi-Private Registrations
CREATE OR REPLACE VIEW public.unmatched_semi_private AS
SELECT
  r.id,
  r.created_at,
  r.payment_status,
  r.form_data->>'playerFullName' as player_name,
  r.form_data->>'playerCategory' as player_category,
  r.form_data->>'parentEmail' as parent_email,
  r.form_data->>'parentPhone' as parent_phone,
  r.form_data->>'semiPrivateAvailability' as availability,
  r.form_data->>'semiPrivateTimeWindows' as time_windows,
  r.form_data->>'semiPrivateMatchingPreference' as matching_preference,
  r.form_data->>'currentLevel' as skill_level,
  r.form_data->>'dateOfBirth' as date_of_birth
FROM public.registrations r
LEFT JOIN public.semi_private_group_members gm ON r.id = gm.registration_id
WHERE
  r.form_data->>'programType' = 'semi-private'
  AND gm.id IS NULL -- Not in any group
ORDER BY r.created_at ASC;

-- View: Semi-Private Groups with Members
CREATE OR REPLACE VIEW public.semi_private_groups_detail AS
SELECT
  g.id as group_id,
  g.group_name,
  g.status,
  g.created_at,
  g.confirmed_at,
  g.scheduled_day,
  g.scheduled_time,
  g.coach_assigned,
  g.notes,
  COUNT(gm.id) as member_count,
  json_agg(
    json_build_object(
      'registration_id', r.id,
      'player_name', r.form_data->>'playerFullName',
      'player_category', r.form_data->>'playerCategory',
      'parent_email', r.form_data->>'parentEmail',
      'skill_level', r.form_data->>'currentLevel',
      'joined_at', gm.joined_at
    )
  ) as members
FROM public.semi_private_groups g
LEFT JOIN public.semi_private_group_members gm ON g.id = gm.group_id
LEFT JOIN public.registrations r ON gm.registration_id = r.id
GROUP BY g.id, g.group_name, g.status, g.created_at, g.confirmed_at,
         g.scheduled_day, g.scheduled_time, g.coach_assigned, g.notes
ORDER BY g.created_at DESC;

-- Function: Create a new semi-private group
CREATE OR REPLACE FUNCTION public.create_semi_private_group(
  p_group_name TEXT,
  p_registration_ids UUID[],
  p_scheduled_day TEXT DEFAULT NULL,
  p_scheduled_time TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
  v_group_id UUID;
  v_reg_id UUID;
BEGIN
  -- Create the group
  INSERT INTO public.semi_private_groups (group_name, scheduled_day, scheduled_time)
  VALUES (p_group_name, p_scheduled_day, p_scheduled_time)
  RETURNING id INTO v_group_id;

  -- Add members to the group
  FOREACH v_reg_id IN ARRAY p_registration_ids
  LOOP
    INSERT INTO public.semi_private_group_members (group_id, registration_id)
    VALUES (v_group_id, v_reg_id);
  END LOOP;

  RETURN v_group_id;
END;
$$;

-- Function: Remove a member from a group
CREATE OR REPLACE FUNCTION public.remove_from_group(p_registration_id UUID)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  DELETE FROM public.semi_private_group_members
  WHERE registration_id = p_registration_id;
END;
$$;

-- Function: Confirm a group (notify parents)
CREATE OR REPLACE FUNCTION public.confirm_semi_private_group(p_group_id UUID)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE public.semi_private_groups
  SET status = 'confirmed', confirmed_at = CURRENT_TIMESTAMP
  WHERE id = p_group_id;
END;
$$;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_group_members_group_id ON public.semi_private_group_members(group_id);
CREATE INDEX IF NOT EXISTS idx_group_members_registration_id ON public.semi_private_group_members(registration_id);
CREATE INDEX IF NOT EXISTS idx_semi_private_groups_status ON public.semi_private_groups(status);

-- Enable RLS
ALTER TABLE public.semi_private_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.semi_private_group_members ENABLE ROW LEVEL SECURITY;

-- RLS Policies (allow anon to read/write for now, adjust as needed)
DROP POLICY IF EXISTS "Allow all access to semi_private_groups" ON public.semi_private_groups;
CREATE POLICY "Allow all access to semi_private_groups"
  ON public.semi_private_groups
  FOR ALL
  TO anon
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all access to semi_private_group_members" ON public.semi_private_group_members;
CREATE POLICY "Allow all access to semi_private_group_members"
  ON public.semi_private_group_members
  FOR ALL
  TO anon
  USING (true)
  WITH CHECK (true);

-- Grant permissions
GRANT ALL ON public.semi_private_groups TO anon;
GRANT ALL ON public.semi_private_group_members TO anon;
GRANT SELECT ON public.unmatched_semi_private TO anon;
GRANT SELECT ON public.semi_private_groups_detail TO anon;
