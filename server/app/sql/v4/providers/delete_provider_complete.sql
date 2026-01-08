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
        COALESCE((SELECT n.name FROM profile_names pn JOIN names n ON pn.name_id = n.id WHERE pn.profile_id = p.id AND pn.type = 'first' LIMIT 1) || ' ' || (SELECT n2.name FROM profile_names pn2 JOIN names n2 ON pn2.name_id = n2.id WHERE pn2.profile_id = p.id AND pn2.type = 'last' LIMIT 1), '') as actor_name
    FROM params x
    JOIN profiles p ON p.id = x.profile_id
),
provider_info AS (
    SELECT 
        pr.id, 
        (SELECT n.name FROM provider_names pn JOIN names n ON pn.name_id = n.id WHERE pn.provider_id = pr.id LIMIT 1) as name
    FROM params x
    JOIN providers pr ON pr.id = x.provider_id
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
        WHERE EXISTS (SELECT 1 FROM model_providers mp WHERE mp.provider_id = (SELECT provider_id FROM params) AND mp.model_id = m.id) AND EXISTS (SELECT 1 FROM model_flags mf JOIN flags fl ON mf.flag_id = fl.id WHERE mf.model_id = m.id AND fl.name = 'active' AND mf.type = 'active'::type_model_flags AND mf.value = true)
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