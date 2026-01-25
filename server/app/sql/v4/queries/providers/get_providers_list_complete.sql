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
    SELECT role, actor_name
    FROM view_user_profile_context
    WHERE profile_id = (SELECT profile_id FROM params)
),
provider_data AS (
    SELECT 
        pr.id as provider_id,
        n.name as name,
        COALESCE((SELECT d.description FROM provider_descriptions_junction pd JOIN descriptions_resource d ON pd.description_id = d.id WHERE pd.provider_id = pr.id LIMIT 1), '') as description,
        n.name as value,
        EXISTS (SELECT 1 FROM provider_flags_junction pf JOIN flags_resource f ON pf.flag_id = f.id WHERE pf.provider_id = pr.id AND f.name = 'provider_active' AND pf.value = TRUE) as active,
        p.created_at,
        p.created_at as updated_at,
        ''::text as base_url,
        CASE 
            WHEN up.role IN ('admin'::profile_type, 'superadmin'::profile_type) THEN true
            ELSE false
        END as can_edit,
        CASE 
            WHEN up.role IN ('admin'::profile_type, 'superadmin'::profile_type) THEN true
            ELSE false
        END as can_delete,
        CASE 
            WHEN up.role IN ('admin'::profile_type, 'superadmin'::profile_type) THEN true
            ELSE false
        END as can_duplicate
    FROM providers_resource p
    JOIN provider_providers_junction ppj ON ppj.providers_id = p.id
    JOIN provider_artifact pr ON pr.id = ppj.provider_id
    JOIN provider_names_junction pn ON pn.provider_id = pr.id
    JOIN names_resource n ON n.id = pn.name_id
    CROSS JOIN user_profile up
    WHERE p.active = true
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
    -- Get provider options FROM providers_resource resource table
    SELECT 
        COALESCE(
            ARRAY_AGG(
                (p.id::text, n.name)::types.q_list_providers_v4_provider_option
                ORDER BY n.name
            ),
            '{}'::types.q_list_providers_v4_provider_option[]
        ) as provider_options
    FROM providers_resource p
    JOIN provider_providers_junction ppj ON ppj.providers_id = p.id
    JOIN provider_artifact pr ON pr.id = ppj.provider_id
    JOIN provider_names_junction pn ON pn.provider_id = pr.id
    JOIN names_resource n ON n.id = pn.name_id
    WHERE p.active = true
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