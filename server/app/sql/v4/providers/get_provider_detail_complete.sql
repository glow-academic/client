-- Get provider detail with endpoint info and permissions
-- Converted to function with composite types
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
        WHERE proname = 'api_get_provider_detail_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_provider_detail_v4(%s)', r.sig);
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
        WHERE typname LIKE 'q_get_provider_detail_v4_%'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I', r.typname);
    END LOOP;
END $$;

-- 4) Recreate function
CREATE OR REPLACE FUNCTION api_get_provider_detail_v4(
    provider_id uuid,
    profile_id uuid,
    draft_id uuid DEFAULT NULL
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
    actor_name text,
    draft_version int
)
LANGUAGE sql
STABLE
AS $$
WITH params AS (
    SELECT 
        provider_id AS provider_id, 
        profile_id AS profile_id,
        draft_id AS draft_id
),
draft_payload_data AS (
    SELECT 
        NULL::jsonb as payload,
        d.version as draft_version
    FROM params x
    JOIN drafts d ON d.id = x.draft_id
    WHERE x.draft_id IS NOT NULL
    AND d.profile_id = x.profile_id
    
    LIMIT 1
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
provider_data AS (
    SELECT 
        p.id as provider_id,
        (SELECT n.name FROM provider_names pn JOIN names n ON pn.name_id = n.id WHERE pn.provider_id = p.id LIMIT 1),
        (SELECT d.description FROM provider_descriptions pd JOIN descriptions d ON pd.description_id = d.id WHERE pd.provider_id = p.id LIMIT 1) as description,
        p.value,
        EXISTS (SELECT 1 FROM provider_flags pf JOIN flags fl ON pf.flag_id = fl.id WHERE pf.provider_id = p.id AND fl.name = 'active' AND pf.type = 'active'::type_provider_flags AND pf.value = TRUE) as active,
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
        WHERE EXISTS (SELECT 1 FROM model_providers mp WHERE mp.provider_id = (SELECT provider_id FROM params) AND mp.model_id = m.id) AND EXISTS (SELECT 1 FROM model_flags mf JOIN flags fl ON mf.flag_id = fl.id WHERE mf.model_id = m.id AND fl.name = 'active' AND mf.type = 'active'::type_model_flags AND mf.value = true)
    ) as is_used
)
SELECT 
    pec.provider_exists::boolean as provider_exists,
    pd.provider_id,
    -- Merge draft payload over existing provider data if draft_id provided
    COALESCE(
        (SELECT payload->>'name' FROM draft_payload_data),
        pd.name
    ) as name,
    COALESCE(
        (SELECT payload->>'description' FROM draft_payload_data),
        pd.description
    ) as description,
    COALESCE(
        (SELECT payload->>'value' FROM draft_payload_data),
        pd.value
    ) as value,
    COALESCE(
        (SELECT (payload->>'active')::boolean FROM draft_payload_data),
        pd.active
    ) as active,
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
    ap.actor_name::text as actor_name,
    COALESCE((SELECT draft_version FROM draft_payload_data), 0) as draft_version
FROM provider_exists_check pec
LEFT JOIN provider_data pd ON pec.provider_exists = true
CROSS JOIN user_profile up
CROSS JOIN check_usage cu
CROSS JOIN actor_profile ap
$$;