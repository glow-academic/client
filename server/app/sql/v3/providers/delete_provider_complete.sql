-- Delete provider (cascade deletes provider_endpoints, setting_provider_keys)
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
        WHERE proname = 'api_delete_provider_v3'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_delete_provider_v3(%s)', r.sig);
    END LOOP;
END $$;

-- 2) Recreate function
CREATE OR REPLACE FUNCTION api_delete_provider_v3(
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
WITH params AS (
    SELECT provider_id AS provider_id, profile_id AS profile_id
),
provider_exists_check AS (
    -- Check if provider exists independently of access control
    SELECT EXISTS(
        SELECT 1 FROM providers WHERE id = (SELECT provider_id FROM params)
    )::boolean as provider_exists
),
actor_profile AS (
    SELECT 
        p.first_name || ' ' || p.last_name as actor_name
    FROM params x
    JOIN profiles p ON p.id = x.profile_id
),
provider_info AS (
    SELECT id, name 
    FROM params x
    JOIN providers ON providers.id = x.provider_id
),
user_profile AS (
    SELECT role 
    FROM params x
    JOIN profiles p ON p.id = x.profile_id
),
check_usage AS (
    -- Check if provider is used by models
    SELECT EXISTS(
        SELECT 1 FROM models m 
        WHERE m.provider_id = (SELECT provider_id FROM params) AND m.active = true
    ) as is_used
),
check_permissions AS (
    SELECT 
        CASE 
            WHEN cu.is_used THEN false
            WHEN up.role IN ('admin'::profile_role, 'superadmin'::profile_role) THEN true
            ELSE false
        END as can_delete
    FROM user_profile up
    CROSS JOIN check_usage cu
),
delete_provider AS (
    DELETE FROM providers
    WHERE providers.id = (SELECT provider_id FROM params)
    AND EXISTS (SELECT 1 FROM check_permissions WHERE can_delete = true)
    AND NOT EXISTS (SELECT 1 FROM check_usage WHERE is_used = true)
    RETURNING id
)
SELECT 
    pec.provider_exists::boolean as provider_exists,
    pi.id as provider_id,
    pi.name::text as name,
    ap.actor_name::text as actor_name,
    CASE WHEN EXISTS(SELECT 1 FROM delete_provider) THEN true ELSE false END::boolean as deleted
FROM provider_exists_check pec
LEFT JOIN provider_info pi ON pec.provider_exists = true
CROSS JOIN actor_profile ap
$$;

COMMIT;

