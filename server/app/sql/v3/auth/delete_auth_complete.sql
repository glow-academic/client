-- Delete auth entry (cascade will handle auth_items)
-- Converted to function
-- Uses safe drop/recreate pattern: drop function first, then recreate

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
        WHERE proname = 'api_delete_auth_v3'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_delete_auth_v3(%s)', r.sig);
    END LOOP;
END $$;

-- 2) Recreate function
CREATE OR REPLACE FUNCTION api_delete_auth_v3(
    auth_id uuid,
    profile_id uuid
)
RETURNS TABLE (
    auth_exists boolean,
    success boolean,
    name text,
    message text,
    actor_name text
)
LANGUAGE sql
VOLATILE
AS $$
WITH params AS (
    SELECT auth_id AS auth_id,
           profile_id AS profile_id
),
auth_exists_check AS (
    -- Check if auth exists before deletion
    SELECT EXISTS(
        SELECT 1 FROM auth WHERE id = (SELECT auth_id FROM params)
    )::boolean as auth_exists
),
actor_profile AS (
    SELECT 
        x.profile_id as profile_id,
        p.first_name || ' ' || p.last_name as actor_name
    FROM params x
    JOIN profiles p ON p.id = x.profile_id
),
auth_info AS (
    SELECT id, name
    FROM params x
    JOIN auth ON auth.id = x.auth_id
),
delete_result AS (
    DELETE FROM auth
    WHERE id = (SELECT auth_id FROM params)
    RETURNING id
)
SELECT 
    aec.auth_exists::boolean as auth_exists,
    aec.auth_exists::boolean as success,
    COALESCE(ai.name, '')::text as name,
    (COALESCE(ai.name, 'Unknown') || ' deleted successfully')::text as message,
    ap.actor_name::text as actor_name
FROM auth_exists_check aec
CROSS JOIN actor_profile ap
LEFT JOIN auth_info ai ON true
$$;

COMMIT;
