-- Delete profile with validation and name lookup in single function
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
        WHERE proname = 'api_delete_profile_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_delete_profile_v4(%s)', r.sig);
    END LOOP;
END $$;

-- 2) Drop types WITHOUT CASCADE
-- No composite types needed for this function (returns simple types)

-- 3) Recreate function
CREATE OR REPLACE FUNCTION api_delete_profile_v4(
    target_profile_id uuid,
    current_profile_id uuid
)
RETURNS TABLE (
    profile_exists boolean,
    profile_id uuid,
    first_name text,
    last_name text,
    name text,
    deleted boolean,
    actor_name text
)
LANGUAGE sql
VOLATILE
AS $$
WITH params AS (
    SELECT target_profile_id AS target_profile_id,
           current_profile_id AS current_profile_id
),
profile_exists_check AS (
    -- Check if profile exists independently of deletion
    SELECT EXISTS(SELECT 1 FROM profiles WHERE id = (SELECT target_profile_id FROM params))::boolean as profile_exists
),
actor_profile AS (
    SELECT 
        p.first_name || ' ' || p.last_name as actor_name
    FROM params x
    JOIN profiles p ON p.id = x.current_profile_id
),
profile_check AS (
    -- Check if profile exists and get details
    SELECT 
        id,
        first_name,
        last_name,
        first_name || ' ' || last_name as name
    FROM profiles 
    WHERE id = (SELECT target_profile_id FROM params)
),
profile_delete AS (
    -- Delete profile (only if exists)
    DELETE FROM profiles
    WHERE id = (SELECT target_profile_id FROM params)
        AND EXISTS (SELECT 1 FROM profile_check)
    RETURNING id, first_name, last_name, first_name || ' ' || last_name as name
)
-- Return profile info with deletion status
SELECT 
    pec.profile_exists::boolean as profile_exists,
    pc.id as profile_id,
    pc.first_name,
    pc.last_name,
    pc.name,
    CASE WHEN pd.id IS NOT NULL THEN true ELSE false END as deleted,
    ap.actor_name
FROM profile_exists_check pec
CROSS JOIN actor_profile ap
LEFT JOIN profile_check pc ON pec.profile_exists = true
LEFT JOIN profile_delete pd ON pd.id = pc.id
LIMIT 1
$$;

COMMIT;

