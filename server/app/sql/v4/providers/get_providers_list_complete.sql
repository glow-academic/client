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
    JOIN profile p ON p.id = x.profile_id
),
provider_data AS (
    -- Providers is now an enum, not a table - return empty results
    SELECT 
        NULL::uuid as provider_id,
        NULL::text as name,
        NULL::text as description,
        NULL::text as value,
        false::boolean as active,
        NULL::timestamptz as created_at,
        NULL::timestamptz as updated_at,
        ''::text as base_url,
        false::boolean as can_edit,
        false::boolean as can_delete,
        false::boolean as can_duplicate
    WHERE false  -- Always return no rows
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
    -- Get provider options from domain_providers (providers is now enum)
    SELECT 
        COALESCE(
            ARRAY_AGG(
                (dp.provider::text, dp.provider::text)::types.q_list_providers_v4_provider_option
                ORDER BY dp.provider::text
            ),
            '{}'::types.q_list_providers_v4_provider_option[]
        ) as provider_options
    FROM domain_providers dp
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