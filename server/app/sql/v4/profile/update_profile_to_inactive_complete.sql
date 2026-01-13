-- UPDATE profile_artifact to inactive and insert activity in a single transaction
-- Converted to PostgreSQL function
-- Uses safe drop/recreate pattern: drop function first, then types (no CASCADE), then recreate
-- 1) Drop function first (breaks dependency on types)
-- Drop all versions of the function using DO block to handle signature variations
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'socket_update_profile_to_inactive_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS socket_update_profile_to_inactive_v4(%s)', r.sig);
    END LOOP;
END $$;

-- 2) Drop types WITHOUT CASCADE
-- No composite types needed for this function (returns simple types)

-- 3) Recreate function
CREATE OR REPLACE FUNCTION socket_update_profile_to_inactive_v4(
    profile_id uuid,
    last_active timestamptz
)
RETURNS TABLE (
    profile_exists boolean,
    profile_id uuid
)
LANGUAGE sql
VOLATILE
AS $$
WITH get_active_flag AS (
    -- Get the active flag ID
    SELECT id as flag_id
    FROM flags_resource
    WHERE name = 'active'
    LIMIT 1
),
insert_or_update_flag AS (
    -- Insert or update profile_flags to set active = false
    INSERT INTO profile_flags (profile_id, flag_id, type, value)
    SELECT 
        profile_id,
        (SELECT flag_id FROM get_active_flag),
        'active'::type_profile_flags,
        false
    FROM get_active_flag
    ON CONFLICT (profile_id, flag_id, type) 
    DO UPDATE SET value = false
    RETURNING profile_id::uuid as profile_id
),
update_profile AS (
    -- Return profile_id if flag was set
    SELECT profile_id FROM insert_or_update_flag
),
insert_activity AS (
    -- Insert activity record
    INSERT INTO profile_activity (profile_id, last_active)
    SELECT 
        up.profile_id,
        last_active
    FROM update_profile up
)
SELECT 
    EXISTS(SELECT 1 FROM update_profile)::boolean as profile_exists,
    (SELECT profile_id FROM update_profile LIMIT 1)::uuid as profile_id
$$;