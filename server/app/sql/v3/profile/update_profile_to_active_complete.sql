-- Update profile to active and insert activity in a single transaction
-- Converted to PostgreSQL function
-- Uses safe drop/recreate pattern: drop function first, then types (no CASCADE), then recreate

BEGIN;

-- 1) Drop function first (breaks dependency on types)
-- Drop all versions of the function using DO block to handle signature variations
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'socket_update_profile_to_active_v3'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS socket_update_profile_to_active_v3(%s)', r.sig);
    END LOOP;
END $$;

-- 2) Drop types WITHOUT CASCADE
-- No composite types needed for this function (returns simple types)

-- 3) Recreate function
CREATE OR REPLACE FUNCTION socket_update_profile_to_active_v3(
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
WITH update_profile AS (
    -- Update profile to active
    UPDATE profiles 
    SET active = true
    WHERE id = profile_id
    RETURNING id::uuid as profile_id
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

COMMIT;
