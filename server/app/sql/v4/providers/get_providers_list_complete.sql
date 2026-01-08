-- Get providers list with endpoint info and permissions
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
        WHERE proname = 'api_list_providers_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_list_providers_v4(%s)', r.sig);
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
        WHERE typname LIKE 'q_list_providers_v4_%'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I', r.typname);
    END LOOP;
END $$;

-- 3) Recreate types
CREATE TYPE types.q_list_providers_v4_provider AS (
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
    can_duplicate boolean
);

CREATE TYPE types.q_list_providers_v4_provider_option AS (
    value text,
    label text
);

CREATE TYPE types.q_list_providers_v4_status_option AS (
    value text,
    label text
);

-- 4) Recreate function
CREATE OR REPLACE FUNCTION api_list_providers_v4(profile_id uuid)
RETURNS TABLE (
    actor_name text,
    providers types.q_list_providers_v4_provider[],
    provider_options types.q_list_providers_v4_provider_option[],
    status_options types.q_list_providers_v4_status_option[]
)
LANGUAGE sql
STABLE
AS $$
WITH params AS (
    SELECT profile_id AS profile_id
),
user_profile AS (
    SELECT 
        p.role,
        COALESCE((SELECT n.name FROM profile_names pn JOIN names n ON pn.name_id = n.id WHERE pn.profile_id = p.id AND pn.type = 'first' LIMIT 1) || ' ' || (SELECT n2.name FROM profile_names pn2 JOIN names n2 ON pn2.name_id = n2.id WHERE pn2.profile_id = p.id AND pn2.type = 'last' LIMIT 1), '') as actor_name
    FROM params x
    JOIN profiles p ON p.id = x.profile_id
),
provider_data AS (
    SELECT 
        p.id as provider_id,
        (SELECT n.name FROM provider_names pn JOIN names n ON pn.name_id = n.id WHERE pn.provider_id = p.id LIMIT 1) as name,
        (SELECT d.description FROM provider_descriptions pd JOIN descriptions d ON pd.description_id = d.id WHERE pd.provider_id = p.id LIMIT 1) as description,
        p.value,
        EXISTS (SELECT 1 FROM provider_flags pf JOIN flags fl ON pf.flag_id = fl.id WHERE pf.provider_id = p.id AND fl.name = 'active' AND pf.type = 'active'::type_provider_flags AND pf.value = TRUE) as active,
        p.created_at,
        p.updated_at,
        COALESCE(pe.base_url, '') as base_url,
        CASE 
            WHEN up.role IN ('admin'::profile_role, 'superadmin'::profile_role) THEN true
            ELSE false
        END as can_edit,
        CASE 
            -- Check if provider is used by models
            WHEN EXISTS (SELECT 1 FROM model_providers mp JOIN models m ON m.id = mp.model_id WHERE mp.provider_id = p.id AND EXISTS (SELECT 1 FROM model_flags mf JOIN flags fl ON mf.flag_id = fl.id WHERE mf.model_id = m.id AND fl.name = 'active' AND mf.type = 'active'::type_model_flags AND mf.value = true)) THEN false
            WHEN up.role IN ('admin'::profile_role, 'superadmin'::profile_role) THEN true
            ELSE false
        END as can_delete,
        true as can_duplicate
    FROM providers p
    LEFT JOIN provider_endpoints pe ON pe.provider_id = p.id AND pe.active = true
    CROSS JOIN user_profile up
),
providers_agg AS (
    SELECT 
        (SELECT actor_name FROM user_profile LIMIT 1)::text as actor_name,
        COALESCE(
            ARRAY_AGG(
                (pd.provider_id, pd.name, pd.description, pd.value, pd.active, pd.created_at, pd.updated_at, pd.base_url, pd.can_edit, pd.can_delete, pd.can_duplicate)::types.q_list_providers_v4_provider
                ORDER BY pd.created_at DESC
            ),
            '{}'::types.q_list_providers_v4_provider[]
        ) as providers
    FROM provider_data pd
),
provider_options_agg AS (
    SELECT 
        COALESCE(
            ARRAY_AGG(
                (p.value, (SELECT n.name FROM provider_names pn JOIN names n ON pn.name_id = n.id WHERE pn.provider_id = p.id LIMIT 1))::types.q_list_providers_v4_provider_option
                ORDER BY (SELECT n.name FROM provider_names pn JOIN names n ON pn.name_id = n.id WHERE pn.provider_id = p.id LIMIT 1)
            ) FILTER (WHERE EXISTS (SELECT 1 FROM provider_flags pf JOIN flags fl ON pf.flag_id = fl.id WHERE pf.provider_id = p.id AND fl.name = 'active' AND pf.type = 'active'::type_provider_flags AND pf.value = true)),
            '{}'::types.q_list_providers_v4_provider_option[]
        ) as provider_options
    FROM providers p
    WHERE EXISTS (SELECT 1 FROM provider_flags pf JOIN flags fl ON pf.flag_id = fl.id WHERE pf.provider_id = p.id AND fl.name = 'active' AND pf.type = 'active'::type_provider_flags AND pf.value = true)
)
SELECT 
    pa.actor_name,
    pa.providers,
    poa.provider_options,
    ARRAY[
        ('true', 'Active')::types.q_list_providers_v4_status_option,
        ('false', 'Inactive')::types.q_list_providers_v4_status_option
    ]::types.q_list_providers_v4_status_option[] as status_options
FROM providers_agg pa
CROSS JOIN provider_options_agg poa
$$;