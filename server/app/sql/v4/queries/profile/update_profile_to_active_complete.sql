-- UPDATE profile_artifact to active and insert activity_entry in a single transaction
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
        WHERE proname = 'socket_update_profile_to_active_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS socket_update_profile_to_active_v4(%s)', r.sig);
    END LOOP;
END $$;

-- 2) Drop types WITHOUT CASCADE
-- No composite types needed for this function (returns simple types)

-- 3) Recreate function
CREATE OR REPLACE FUNCTION socket_update_profile_to_active_v4(
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
    -- Insert or update profile_flags_junction to set active = true
    INSERT INTO profile_flags_junction (profile_id, flag_id, value) SELECT profile_id,
        (SELECT flag_id FROM get_active_flag),
        true
    FROM get_active_flag
    ON CONFLICT (profile_id, flag_id) 
    DO UPDATE SET value = true
    RETURNING profile_id::uuid as profile_id
),
update_profile AS (
    -- Return profile_id if flag was set
    SELECT profile_id FROM insert_or_update_flag
),
insert_activity AS (
    -- Insert activity_entry record
    INSERT INTO activity_entry (last_active)
    SELECT last_active
    FROM update_profile up
    RETURNING id as activity_id
),
link_activity_to_profile AS (
    -- Link activity to profile via junction table
    INSERT INTO profile_activity_junction (profile_id, activity_id)
    SELECT up.profile_id, ia.activity_id
    FROM update_profile up
    CROSS JOIN insert_activity ia
)
SELECT 
    EXISTS(SELECT 1 FROM update_profile)::boolean as profile_exists,
    (SELECT profile_id FROM update_profile LIMIT 1)::uuid as profile_id
$$;