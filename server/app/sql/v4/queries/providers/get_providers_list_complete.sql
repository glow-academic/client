-- Get providers list with raw data for Python-side permission computation
-- Returns user_role so Python can compute can_edit/can_delete/can_duplicate per provider
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
    updated_at timestamptz,
    department_ids uuid[],
    model_usage_count int
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
    user_role text,
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
        COALESCE((SELECT v.value FROM provider_values_junction pvj JOIN values_resource v ON pvj.values_id = v.id WHERE pvj.provider_id = pr.id AND pvj.active = true LIMIT 1), '') as value,
        EXISTS (SELECT 1 FROM provider_flags_junction pf JOIN flags_resource f ON pf.flag_id = f.id WHERE pf.provider_id = pr.id AND f.name = 'provider_active' AND pf.value = TRUE) as active,
        pr.updated_at,
        COALESCE(
            (SELECT ARRAY_AGG(pdj.department_id ORDER BY pdj.created_at)
             FROM provider_departments_junction pdj
             WHERE pdj.provider_id = pr.id AND pdj.active = true),
            ARRAY[]::uuid[]
        ) as department_ids,
        COALESCE(
            (SELECT COUNT(DISTINCT mpj.model_id)::int
             FROM provider_providers_junction ppj
             JOIN model_providers_junction mpj ON mpj.providers_id = ppj.providers_id
             WHERE ppj.provider_id = pr.id),
            0
        ) as model_usage_count
    FROM providers_resource p
    JOIN provider_providers_junction ppj ON ppj.providers_id = p.id
    JOIN provider_artifact pr ON pr.id = ppj.provider_id
    JOIN provider_names_junction pn ON pn.provider_id = pr.id
    JOIN names_resource n ON n.id = pn.name_id
    WHERE p.active = true
),
providers_agg AS (
    SELECT
        COALESCE(
            ARRAY_AGG(
                (pd.provider_id, pd.name, pd.description, pd.value, pd.active, pd.updated_at, pd.department_ids, pd.model_usage_count)::types.q_list_providers_v4_provider
                ORDER BY pd.updated_at DESC NULLS LAST
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
    up.actor_name::text as actor_name,
    up.role::text as user_role,
    pa.providers,
    poa.provider_options,
    ARRAY[
        ('true', 'Active')::types.q_list_providers_v4_status_option,
        ('false', 'Inactive')::types.q_list_providers_v4_status_option
    ]::types.q_list_providers_v4_status_option[] as status_options
FROM user_profile up
CROSS JOIN providers_agg pa
CROSS JOIN provider_options_agg poa
$$;
