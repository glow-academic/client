-- Create provider with optional endpoint in a single transaction
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
        WHERE proname = 'api_create_provider_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_create_provider_v4(%s)', r.sig);
    END LOOP;
END $$;

-- 2) Recreate function
CREATE OR REPLACE FUNCTION api_create_provider_v4(
    name text,
    description text,
    value text,
    active boolean,
    base_url text,
    profile_id uuid
)
RETURNS TABLE (
    provider_id uuid,
    actor_name text
)
LANGUAGE sql
VOLATILE
AS $$
WITH actor_profile AS (
    SELECT 
        COALESCE((SELECT n.name FROM profile_names pn JOIN names n ON pn.name_id = n.id WHERE pn.profile_id = api_create_provider_v4.profile_id AND pn.type = 'first' LIMIT 1) || ' ' || (SELECT n2.name FROM profile_names pn2 JOIN names n2 ON pn2.name_id = n2.id WHERE pn2.profile_id = api_create_provider_v4.profile_id AND pn2.type = 'last' LIMIT 1), '') as actor_name
)
-- Providers is now an enum, not a table - cannot create providers
-- Return NULL to indicate operation not supported
SELECT 
    NULL::uuid as provider_id,
    ap.actor_name::text as actor_name
FROM actor_profile ap
$$;