-- Get providers list with endpoint info and permissions
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
        WHERE proname = 'api_list_providers_v3'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_list_providers_v3(%s)', r.sig);
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
        WHERE typname LIKE 'q_list_providers_v3_%'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I', r.typname);
    END LOOP;
END $$;

-- 3) Recreate types
CREATE TYPE types.q_list_providers_v3_provider AS (
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

CREATE TYPE types.q_list_providers_v3_provider_option AS (
    value text,
    label text
);

CREATE TYPE types.q_list_providers_v3_status_option AS (
    value text,
    label text
);

-- 4) Recreate function
CREATE OR REPLACE FUNCTION api_list_providers_v3(profile_id uuid)
RETURNS TABLE (
    actor_name text,
    providers types.q_list_providers_v3_provider[],
    provider_options types.q_list_providers_v3_provider_option[],
    status_options types.q_list_providers_v3_status_option[]
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
        COALESCE(pe.base_url, '') as base_url,
        CASE 
            WHEN up.role IN (profile_role.admin, profile_role.superadmin) THEN true
            ELSE false
        END as can_edit,
        CASE 
            -- Check if provider is used by models
            WHEN EXISTS (SELECT 1 FROM models m WHERE m.provider_id = p.id AND m.active = true) THEN false
            WHEN up.role IN (profile_role.admin, profile_role.superadmin) THEN true
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
                (pd.provider_id, pd.name, pd.description, pd.value, pd.active, pd.created_at, pd.updated_at, pd.base_url, pd.can_edit, pd.can_delete, pd.can_duplicate)::types.q_list_providers_v3_provider
                ORDER BY pd.created_at DESC
            ),
            '{}'::types.q_list_providers_v3_provider[]
        ) as providers
    FROM provider_data pd
),
provider_options_agg AS (
    SELECT 
        COALESCE(
            ARRAY_AGG(
                (p.value, p.name)::types.q_list_providers_v3_provider_option
                ORDER BY p.name
            ) FILTER (WHERE p.active = true),
            '{}'::types.q_list_providers_v3_provider_option[]
        ) as provider_options
    FROM providers p
    WHERE p.active = true
)
SELECT 
    pa.actor_name,
    pa.providers,
    poa.provider_options,
    ARRAY[
        ('true', 'Active')::types.q_list_providers_v3_status_option,
        ('false', 'Inactive')::types.q_list_providers_v3_status_option
    ]::types.q_list_providers_v3_status_option[] as status_options
FROM providers_agg pa
CROSS JOIN provider_options_agg poa
$$;

COMMIT;

