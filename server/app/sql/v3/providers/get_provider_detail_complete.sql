-- Get provider detail with endpoint info and permissions
-- Converted to function with composite types
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
        WHERE proname = 'api_get_provider_detail_v3'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_provider_detail_v3(%s)', r.sig);
    END LOOP;
END $$;

-- 2) Drop types WITHOUT CASCADE
-- Drop all types matching prefix pattern to handle type additions/removals
-- If any other object depends on them, this will ERROR and stop the migration (good)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT typname 
        FROM pg_type 
        WHERE typname LIKE 'q_get_provider_detail_v3_%'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I', r.typname);
    END LOOP;
END $$;

-- 4) Recreate function
CREATE OR REPLACE FUNCTION api_get_provider_detail_v3(
    provider_id uuid,
    profile_id uuid
)
RETURNS TABLE (
    provider_exists boolean,
    provider_id uuid,
    name text,
    description text,
    value text,
    active boolean,
    created_at timestamptz,
    updated_at timestamptz,
    base_url text,
    can_edit boolean,
    can_delete boolean,
    actor_name text
)
LANGUAGE sql
STABLE
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
provider_data AS (
    SELECT 
        p.id as provider_id,
        p.name,
        p.description,
        p.value,
        p.active,
        p.created_at,
        p.updated_at,
        COALESCE(pe.base_url, '') as base_url
    FROM providers p
    LEFT JOIN provider_endpoints pe ON pe.provider_id = p.id AND pe.active = true
    WHERE p.id = (SELECT provider_id FROM params)
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
)
SELECT 
    pec.provider_exists::boolean as provider_exists,
    pd.provider_id,
    pd.name,
    pd.description,
    pd.value,
    pd.active,
    pd.created_at,
    pd.updated_at,
    pd.base_url,
    CASE 
        WHEN up.role IN ('admin'::profile_role, 'superadmin'::profile_role) THEN true
        ELSE false
    END as can_edit,
    CASE 
        WHEN cu.is_used THEN false
        WHEN up.role IN ('admin'::profile_role, 'superadmin'::profile_role) THEN true
        ELSE false
    END as can_delete,
    ap.actor_name::text as actor_name
FROM provider_exists_check pec
LEFT JOIN provider_data pd ON pec.provider_exists = true
CROSS JOIN user_profile up
CROSS JOIN check_usage cu
CROSS JOIN actor_profile ap
$$;

COMMIT;
