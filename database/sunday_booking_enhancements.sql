-- ============================================
-- SUNDAY BOOKING SYSTEM ENHANCEMENTS
-- ============================================
-- This migration adds:
-- 1. Enhanced attendance tracking with enum status
-- 2. Admin roster management functions
-- 3. M7-M9 eligibility support
-- 4. Capacity information in booking queries
-- ============================================

-- ============================================
-- PART 1: Enhanced Attendance Tracking
-- ============================================

-- Create attendance status enum
DO $$ BEGIN
  CREATE TYPE attendance_status_enum AS ENUM ('pending', 'attended', 'absent', 'excused');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Add new columns to sunday_bookings table
ALTER TABLE public.sunday_bookings
  ADD COLUMN IF NOT EXISTS attendance_status attendance_status_enum DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS attendance_notes TEXT DEFAULT NULL;

-- Update existing attended boolean values to new enum
UPDATE public.sunday_bookings
SET attendance_status = CASE
  WHEN attended = true THEN 'attended'::attendance_status_enum
  WHEN attended = false THEN 'absent'::attendance_status_enum
  ELSE 'pending'::attendance_status_enum
END
WHERE attendance_status = 'pending';

-- We'll keep the old 'attended' column for backward compatibility for now
-- Can drop it later: ALTER TABLE public.sunday_bookings DROP COLUMN IF EXISTS attended;

COMMENT ON COLUMN public.sunday_bookings.attendance_status IS 'Attendance status: pending (not marked), attended, absent, or excused';
COMMENT ON COLUMN public.sunday_bookings.attendance_notes IS 'Optional admin notes about attendance';

-- ============================================
-- PART 2: Mark Attendance Function
-- ============================================

CREATE OR REPLACE FUNCTION public.mark_attendance(
  p_booking_id UUID,
  p_attendance_status TEXT,  -- 'attended', 'absent', or 'excused'
  p_admin_email TEXT,
  p_notes TEXT DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
  v_booking_status TEXT;
  v_slot_date DATE;
BEGIN
  -- 1. Validate attendance status
  IF p_attendance_status NOT IN ('attended', 'absent', 'excused') THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Invalid attendance status. Must be: attended, absent, or excused',
      'code', 'INVALID_STATUS'
    );
  END IF;

  -- 2. Get booking details
  SELECT b.booking_status, s.practice_date
  INTO v_booking_status, v_slot_date
  FROM public.sunday_bookings b
  INNER JOIN public.sunday_practice_slots s ON b.slot_id = s.id
  WHERE b.id = p_booking_id;

  IF NOT FOUND THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Booking not found',
      'code', 'BOOKING_NOT_FOUND'
    );
  END IF;

  -- 3. Check if booking is cancelled
  IF v_booking_status = 'cancelled' THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Cannot mark attendance for cancelled booking',
      'code', 'BOOKING_CANCELLED'
    );
  END IF;

  -- 4. Update attendance
  UPDATE public.sunday_bookings
  SET
    attendance_status = p_attendance_status::attendance_status_enum,
    attendance_notes = p_notes,
    attendance_marked_at = NOW(),
    attendance_marked_by = p_admin_email,
    attended = CASE WHEN p_attendance_status = 'attended' THEN true ELSE false END,  -- Keep old column in sync
    updated_at = NOW()
  WHERE id = p_booking_id;

  -- 5. Return success
  RETURN json_build_object(
    'success', true,
    'booking_id', p_booking_id,
    'attendance_status', p_attendance_status,
    'marked_at', NOW(),
    'marked_by', p_admin_email,
    'message', 'Attendance marked successfully'
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'success', false,
      'error', SQLERRM,
      'code', 'DATABASE_ERROR'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.mark_attendance IS 'Admin function to mark attendance for Sunday practice bookings';

GRANT EXECUTE ON FUNCTION public.mark_attendance TO authenticated;

-- ============================================
-- PART 3: Get Sunday Roster Function
-- ============================================

CREATE OR REPLACE FUNCTION public.get_sunday_roster(
  p_practice_date DATE
)
RETURNS JSON AS $$
DECLARE
  v_roster JSON;
  v_stats JSON;
BEGIN
  -- 1. Build roster data with slots and bookings
  SELECT json_build_object(
    'practice_date', p_practice_date,
    'slots', json_agg(slot_data ORDER BY slot_data->>'start_time')
  )
  INTO v_roster
  FROM (
    SELECT json_build_object(
      'slot_id', s.id,
      'start_time', s.start_time,
      'end_time', s.end_time,
      'time_range', CONCAT(
        TO_CHAR(s.start_time, 'HH12:MI AM'),
        ' - ',
        TO_CHAR(s.end_time, 'HH12:MI AM')
      ),
      'min_category', s.min_category,
      'max_category', s.max_category,
      'max_capacity', s.max_capacity,
      'current_bookings', s.current_bookings,
      'available_spots', s.available_spots,
      'bookings', COALESCE(
        (
          SELECT json_agg(
            json_build_object(
              'booking_id', b.id,
              'player_name', b.player_name,
              'player_category', b.player_category,
              'parent_name', b.parent_name,
              'parent_email', b.parent_email,
              'booking_status', b.booking_status,
              'booked_at', b.booked_at,
              'cancelled_at', b.cancelled_at,
              'attendance_status', b.attendance_status,
              'attendance_marked_at', b.attendance_marked_at,
              'attendance_marked_by', b.attendance_marked_by,
              'attendance_notes', b.attendance_notes,
              'registration_id', b.registration_id
            )
            ORDER BY b.booked_at
          )
          FROM public.sunday_bookings b
          WHERE b.slot_id = s.id AND b.booking_status != 'cancelled'
        ),
        '[]'::json
      )
    ) as slot_data
    FROM public.sunday_practice_slots s
    WHERE s.practice_date = p_practice_date
      AND s.is_active = true
  ) slots;

  -- 2. Calculate statistics
  SELECT json_build_object(
    'total_bookings', COUNT(*),
    'attended_count', COUNT(*) FILTER (WHERE attendance_status = 'attended'),
    'absent_count', COUNT(*) FILTER (WHERE attendance_status = 'absent'),
    'excused_count', COUNT(*) FILTER (WHERE attendance_status = 'excused'),
    'pending_count', COUNT(*) FILTER (WHERE attendance_status = 'pending'),
    'attendance_rate', CASE
      WHEN COUNT(*) FILTER (WHERE attendance_status != 'pending') > 0
      THEN ROUND(
        (COUNT(*) FILTER (WHERE attendance_status = 'attended')::NUMERIC /
         COUNT(*) FILTER (WHERE attendance_status != 'pending')::NUMERIC) * 100,
        1
      )
      ELSE 0
    END
  )
  INTO v_stats
  FROM public.sunday_bookings b
  INNER JOIN public.sunday_practice_slots s ON b.slot_id = s.id
  WHERE s.practice_date = p_practice_date
    AND b.booking_status != 'cancelled';

  -- 3. Return combined result
  RETURN json_build_object(
    'success', true,
    'roster', v_roster,
    'stats', v_stats
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'success', false,
      'error', SQLERRM,
      'code', 'DATABASE_ERROR'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.get_sunday_roster IS 'Admin function to get complete roster for a Sunday practice date with attendance stats';

GRANT EXECUTE ON FUNCTION public.get_sunday_roster TO authenticated;

-- ============================================
-- PART 4: Update Sunday Bookings Detail View
-- ============================================

DROP VIEW IF EXISTS public.sunday_bookings_detail;

CREATE OR REPLACE VIEW public.sunday_bookings_detail AS
SELECT
  -- Booking info
  b.id AS booking_id,
  b.booking_status,
  b.booked_at,
  b.cancelled_at,
  b.attendance_status,
  b.attendance_marked_at,
  b.attendance_marked_by,
  b.attendance_notes,
  b.attended,  -- Keep for backward compatibility

  -- Slot info
  s.id AS slot_id,
  s.practice_date,
  s.start_time,
  s.end_time,
  s.min_category,
  s.max_category,
  s.max_capacity,
  s.current_bookings,
  s.available_spots,
  s.is_active,

  -- Player info
  b.player_name,
  b.player_category,
  b.parent_email,
  b.parent_name,

  -- Registration info
  b.registration_id,
  r.firebase_uid,
  r.payment_status,

  -- Derived fields
  CONCAT(
    TO_CHAR(s.start_time, 'HH12:MI AM'),
    ' - ',
    TO_CHAR(s.end_time, 'HH12:MI AM')
  ) AS time_range,

  CASE
    WHEN b.attendance_status = 'attended' THEN 'Attended'
    WHEN b.attendance_status = 'absent' THEN 'Absent'
    WHEN b.attendance_status = 'excused' THEN 'Excused'
    WHEN b.booking_status = 'cancelled' THEN 'Cancelled'
    WHEN s.practice_date < CURRENT_DATE THEN 'Past'
    WHEN s.practice_date = CURRENT_DATE THEN 'Today'
    ELSE 'Upcoming'
  END AS booking_display_status

FROM public.sunday_bookings b
INNER JOIN public.sunday_practice_slots s ON b.slot_id = s.id
INNER JOIN public.registrations r ON b.registration_id = r.id
ORDER BY s.practice_date DESC, s.start_time ASC;

COMMENT ON VIEW public.sunday_bookings_detail IS 'Enriched view of Sunday practice bookings with slot and player details for admin and parent dashboards';

-- ============================================
-- VERIFICATION QUERIES
-- ============================================

-- Check new columns exist
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'sunday_bookings'
  AND column_name IN ('attendance_status', 'attendance_notes')
ORDER BY column_name;

-- Check new functions exist
SELECT routine_name, routine_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN ('mark_attendance', 'get_sunday_roster')
ORDER BY routine_name;

-- Check enum type exists
SELECT typname, enumlabel
FROM pg_type t
JOIN pg_enum e ON t.oid = e.enumtypid
WHERE typname = 'attendance_status_enum'
ORDER BY enumlabel;
