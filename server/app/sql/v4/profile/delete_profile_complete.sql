-- Delete profile with validation and name lookup in single function
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
        COALESCE((SELECT n.name FROM profile_names pn JOIN names n ON pn.name_id = n.id WHERE pn.profile_id = p.id AND pn.type = 'first' LIMIT 1) || ' ' || (SELECT n2.name FROM profile_names pn2 JOIN names n2 ON pn2.name_id = n2.id WHERE pn2.profile_id = p.id AND pn2.type = 'last' LIMIT 1), '') as actor_name
    FROM params x
    JOIN profiles p ON p.id = x.current_profile_id
),
profile_check AS (
    -- Check if profile exists and get details
    SELECT 
        p.id,
        (SELECT n.name FROM profile_names pn JOIN names n ON pn.name_id = n.id WHERE pn.profile_id = p.id AND pn.type = 'first' LIMIT 1) as first_name,
        (SELECT n2.name FROM profile_names pn2 JOIN names n2 ON pn2.name_id = n2.id WHERE pn2.profile_id = p.id AND pn2.type = 'last' LIMIT 1) as last_name,
        COALESCE((SELECT n.name FROM profile_names pn JOIN names n ON pn.name_id = n.id WHERE pn.profile_id = p.id AND pn.type = 'first' LIMIT 1) || ' ' || (SELECT n2.name FROM profile_names pn2 JOIN names n2 ON pn2.name_id = n2.id WHERE pn2.profile_id = p.id AND pn2.type = 'last' LIMIT 1), '') as name
    FROM profiles p
    WHERE p.id = (SELECT target_profile_id FROM params)
),
profile_delete AS (
    -- Delete profile (only if exists)
    DELETE FROM profiles
    WHERE id = (SELECT target_profile_id FROM params)
        AND EXISTS (SELECT 1 FROM profile_check)
    RETURNING id
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