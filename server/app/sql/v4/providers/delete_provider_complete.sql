-- Delete provider (cascade deletes provider_endpoints, setting_provider_keys)
-- Converted to function
-- Uses safe drop/recreate pattern: drop function first, then recreate
-- 1) Drop function first (breaks dependency on types)
-- Drop all versions of the function using DO block to handle signature variations
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'api_delete_provider_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_delete_provider_v4(%s)', r.sig);
    END LOOP;
END $$;

-- 2) Recreate function
CREATE OR REPLACE FUNCTION api_delete_provider_v4(
    provider_id uuid,
    profile_id uuid
)
RETURNS TABLE (
    provider_exists boolean,
    provider_id uuid,
    name text,
    actor_name text,
    deleted boolean
)
LANGUAGE sql
VOLATILE
AS $$
WITH actor_profile AS (
    SELECT 
        COALESCE((SELECT n.name FROM profile_names pn JOIN names n ON pn.name_id = n.id WHERE pn.profile_id = api_delete_provider_v4.profile_id AND pn.type = 'first' LIMIT 1) || ' ' || (SELECT n2.name FROM profile_names pn2 JOIN names n2 ON pn2.name_id = n2.id WHERE pn2.profile_id = api_delete_provider_v4.profile_id AND pn2.type = 'last' LIMIT 1), '') as actor_name
)
-- Providers is now an enum, not a table - cannot delete providers
SELECT 
    false::boolean as provider_exists,
    NULL::uuid as provider_id,
    NULL::text as name,
    ap.actor_name::text as actor_name,
    false::boolean as deleted
FROM actor_profile ap
$$;