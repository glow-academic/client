-- Get providers list with raw data for Python-side permission computation
-- Resource-first: only touches provider_artifact + provider's own junctions + resource tables
-- Filter option names hydrated from cached *_internal() functions in Python
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
    model_usage_count int,
    model_ids uuid[]
);

CREATE TYPE types.q_list_providers_v4_status_option AS (
    value text,
    label text
);

-- Filter option types simplified: id + count only (names hydrated in Python from cache)
CREATE TYPE types.q_list_providers_v4_option_id AS (
    id uuid,
    count bigint
);

-- 4) Recreate function
CREATE OR REPLACE FUNCTION api_list_providers_v4(profile_id uuid)
RETURNS TABLE (
    providers types.q_list_providers_v4_provider[],
    provider_option_ids types.q_list_providers_v4_option_id[],
    department_option_ids types.q_list_providers_v4_option_id[],
    model_option_ids types.q_list_providers_v4_option_id[],
    status_options types.q_list_providers_v4_status_option[],
    total_count bigint
)
LANGUAGE sql
STABLE
AS $$
-- User context (actor_name, user_role, department_ids) comes from get_profile_context_internal() in Python
WITH params AS (
    SELECT profile_id AS profile_id
),
user_departments AS (
    SELECT department_id
    FROM params x
    JOIN profile_departments_junction pd ON pd.profile_id = x.profile_id AND pd.active = true
),
model_data AS (
    SELECT
        pr.id as provider_id,
        COALESCE(
            ARRAY_AGG(DISTINCT mr.id) FILTER (WHERE mr.id IS NOT NULL),
            ARRAY[]::uuid[]
        ) as model_ids
    FROM provider_artifact pr
    LEFT JOIN provider_providers_junction ppj ON ppj.provider_id = pr.id
    LEFT JOIN providers_resource p ON p.id = ppj.providers_id AND p.active = true
    LEFT JOIN models_resource mr ON mr.provider_id = p.id AND mr.active = true
    GROUP BY pr.id
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
            (SELECT COUNT(DISTINCT mr.id)::int
             FROM models_resource mr
             WHERE mr.provider_id = p.id AND mr.active = true),
            0
        ) as model_usage_count,
        COALESCE(md.model_ids, ARRAY[]::uuid[]) as model_ids
    FROM providers_resource p
    JOIN provider_providers_junction ppj ON ppj.providers_id = p.id
    JOIN provider_artifact pr ON pr.id = ppj.provider_id
    JOIN provider_names_junction pn ON pn.provider_id = pr.id
    JOIN names_resource n ON n.id = pn.name_id
    LEFT JOIN model_data md ON md.provider_id = pr.id
    WHERE p.active = true
),
providers_agg AS (
    SELECT
        COALESCE(
            ARRAY_AGG(
                (pd.provider_id, pd.name, pd.description, pd.value, pd.active, pd.updated_at, pd.department_ids, pd.model_usage_count, pd.model_ids)::types.q_list_providers_v4_provider
                ORDER BY pd.updated_at DESC NULLS LAST
            ),
            '{}'::types.q_list_providers_v4_provider[]
        ) as providers
    FROM provider_data pd
),
-- Filter option IDs with counts (names hydrated in Python from cached *_internal() functions)
provider_option_data AS (
    SELECT
        p.id,
        (SELECT COUNT(*) FROM provider_data pd WHERE pd.provider_id IS NOT NULL)::bigint as count
    FROM providers_resource p
    WHERE p.active = true
      AND EXISTS (SELECT 1 FROM provider_providers_junction ppj WHERE ppj.providers_id = p.id)
),
department_option_data AS (
    SELECT
        dr.id,
        (SELECT COUNT(*) FROM provider_data)::bigint as count
    FROM departments_resource dr
    WHERE dr.id IN (SELECT department_id FROM user_departments)
),
all_model_ids AS (
    SELECT DISTINCT unnest(model_ids) as model_id
    FROM provider_data
    WHERE model_ids IS NOT NULL AND array_length(model_ids, 1) > 0
),
model_option_data AS (
    SELECT
        mr.id,
        (SELECT COUNT(*) FROM provider_data pd WHERE mr.id = ANY(pd.model_ids))::bigint as count
    FROM models_resource mr
    WHERE mr.id IN (SELECT model_id FROM all_model_ids)
)
SELECT
    pa.providers,
    -- Provider option IDs with counts (names hydrated in Python)
    COALESCE(
        (SELECT ARRAY_AGG(
            (pod.id, pod.count)::types.q_list_providers_v4_option_id
        ) FROM provider_option_data pod),
        '{}'::types.q_list_providers_v4_option_id[]
    ) as provider_option_ids,
    -- Department option IDs with counts (names hydrated in Python)
    COALESCE(
        (SELECT ARRAY_AGG(
            (dod.id, dod.count)::types.q_list_providers_v4_option_id
        ) FROM department_option_data dod),
        '{}'::types.q_list_providers_v4_option_id[]
    ) as department_option_ids,
    -- Model option IDs with counts (names hydrated in Python)
    COALESCE(
        (SELECT ARRAY_AGG(
            (mod.id, mod.count)::types.q_list_providers_v4_option_id
        ) FROM model_option_data mod),
        '{}'::types.q_list_providers_v4_option_id[]
    ) as model_option_ids,
    ARRAY[
        ('true', 'Active')::types.q_list_providers_v4_status_option,
        ('false', 'Inactive')::types.q_list_providers_v4_status_option
    ]::types.q_list_providers_v4_status_option[] as status_options,
    -- Total count
    (SELECT COUNT(*) FROM provider_data)::bigint as total_count
FROM params
CROSS JOIN providers_agg pa
$$;
