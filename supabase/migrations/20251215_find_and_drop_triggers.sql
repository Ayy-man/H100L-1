-- First, let's find all triggers
SELECT
    tgname as trigger_name,
    tgrelid::regclass as table_name,
    tgfoid::regproc as function_name,
    tgenabled as is_enabled
FROM pg_trigger
WHERE tgrelid = 'public.registrations'::regclass
   OR tgfoid::regproc LIKE '%time_slot%'
   OR tgfoid::regproc LIKE '%slot_count%';

-- Drop any triggers that reference time_slots
DO $$
DECLARE
    trigger_rec RECORD;
BEGIN
    FOR trigger_rec IN
        SELECT tgname
        FROM pg_trigger
        WHERE tgfoid::regproc LIKE '%time_slot%'
           OR tgfoid::regproc LIKE '%slot_count%'
    LOOP
        EXECUTE 'DROP TRIGGER IF EXISTS ' || trigger_rec.tgname || ' ON public.registrations';
        RAISE NOTICE 'Dropped trigger: %', trigger_rec.tgname;
    END LOOP;
END $$;

-- Now drop the functions themselves
DROP FUNCTION IF EXISTS update_time_slot_counts() CASCADE;
DROP FUNCTION IF EXISTS trigger_update_slot_counts() CASCADE;

-- Check if there are any other functions referencing time_slots
SELECT
    proname as function_name,
    pg_get_function_arguments(oid) as arguments
FROM pg_proc
WHERE proname LIKE '%time_slot%'
   OR proname LIKE '%slot_count%';