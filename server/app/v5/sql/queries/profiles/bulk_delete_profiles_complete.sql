-- Bulk delete staff profiles with validation in single function
-- Converted to PostgreSQL function with composite types
-- Uses safe drop/recreate pattern: drop function first, then types (no CASCADE), then recreate
-- 1) Drop function first (breaks dependency on types)
-- 1) Drop function first (breaks dependency on types)
-- Drop all versions of the function using DO block to handle signature variations
DO $$
DECLARE
    r RECORD;
BEGIN
    -- Drop old-named function (from before rename)
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_bulk_delete_staff_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_bulk_delete_staff_v4(%s)', r.sig);
    END LOOP;
    -- Drop new-named function
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_bulk_delete_profiles_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_bulk_delete_profiles_v4(%s)', r.sig);
    END LOOP;
END $$;

-- 2) Drop types WITHOUT CASCADE
-- No composite types needed for this function (returns simple types)

-- 3) Recreate function
CREATE OR REPLACE FUNCTION api_bulk_delete_profiles_v4(
    profile_ids uuid[],
    profile_id uuid  -- current user's profile_id for audit
)
RETURNS TABLE (
    deleted_count integer
)
LANGUAGE sql
VOLATILE
AS $$
-- User context (actor_name, user_role, department_ids) comes from get_profile_context_internal() in Python
WITH params AS (
    SELECT 
        profile_ids AS profile_ids,
        profile_id AS profile_id
),
deletable_profiles AS (
    -- Get list of profiles that can be deleted
    SELECT array_agg(p.id) as deletable_ids
    FROM profile_artifact p
    CROSS JOIN params pr
    WHERE p.id = ANY(pr.profile_ids)
),
profile_delete AS (
    -- Delete profiles
    DELETE FROM profile_artifact p
    WHERE EXISTS (
        SELECT 1 FROM params pr WHERE p.id = ANY(pr.profile_ids)
    )
        AND EXISTS (SELECT 1 FROM deletable_profiles WHERE deletable_ids IS NOT NULL)
    RETURNING p.id
)
-- Return deletion count and actor_name
SELECT 
    COALESCE((SELECT COUNT(*) FROM profile_delete), 0)::int as deleted_count
FROM deletable_profiles dp
$$;
