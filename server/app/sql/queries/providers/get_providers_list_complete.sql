-- Get providers list with raw data for Python-side permission computation
-- Resource-first: only touches provider_artifact + provider's own junctions + resource tables
-- Filter option names resolved in SQL via ListFilterSection pattern
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
    active_model_count int,
    model_ids uuid[]
);

-- Filter option type: value/label/count (names resolved in SQL, no Python hydration needed)
CREATE TYPE types.q_list_providers_v4_option AS (
    value text,
    label text,
    count bigint
);

-- 4) Recreate function
CREATE OR REPLACE FUNCTION api_list_providers_v4(
    profile_id uuid,
    search text DEFAULT NULL,
    filter_department_ids uuid[] DEFAULT NULL,
    filter_model_ids uuid[] DEFAULT NULL,
    filter_status text[] DEFAULT NULL,
    department_search text DEFAULT NULL,
    model_search text DEFAULT NULL,
    page_size int DEFAULT 1000,
    page_offset int DEFAULT 0
)
RETURNS TABLE (
    providers types.q_list_providers_v4_provider[],
    department_options types.q_list_providers_v4_option[],
    model_options types.q_list_providers_v4_option[],
    status_options types.q_list_providers_v4_option[],
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
        COALESCE((SELECT d.description FROM provider_descriptions_junction pd JOIN descriptions_resource d ON pd.descriptions_id = d.id WHERE pd.provider_id = pr.id LIMIT 1), '') as description,
        COALESCE((SELECT v.value FROM provider_values_junction pvj JOIN values_resource v ON pvj.values_id = v.id WHERE pvj.provider_id = pr.id AND pvj.active = true LIMIT 1), '') as value,
        EXISTS (SELECT 1 FROM provider_flags_junction pf JOIN flags_resource f ON pf.flags_id = f.id WHERE pf.provider_id = pr.id AND f.name = 'provider_active' AND f.value = TRUE) as active,
        pr.updated_at,
        COALESCE(
            (SELECT ARRAY_AGG(pdj.departments_id ORDER BY pdj.created_at)
             FROM provider_departments_junction pdj
             WHERE pdj.provider_id = pr.id AND pdj.active = true),
            ARRAY[]::uuid[]
        ) as department_ids,
        COALESCE(
            (SELECT COUNT(DISTINCT mr.id)::int
             FROM models_resource mr
             WHERE mr.provider_id = p.id AND mr.active = true),
            0
        ) as active_model_count,
        COALESCE(md.model_ids, ARRAY[]::uuid[]) as model_ids
    FROM providers_resource p
    JOIN provider_providers_junction ppj ON ppj.providers_id = p.id
    JOIN provider_artifact pr ON pr.id = ppj.provider_id
    JOIN provider_names_junction pn ON pn.provider_id = pr.id
    JOIN names_resource n ON n.id = pn.names_id
    LEFT JOIN model_data md ON md.provider_id = pr.id
    WHERE p.active = true
),
-- Apply server-side filters
filtered_providers AS (
    SELECT pd.*
    FROM provider_data pd
    WHERE
        -- Search filter
        (search IS NULL OR LOWER(pd.name) LIKE '%' || LOWER(search) || '%' OR LOWER(pd.description) LIKE '%' || LOWER(search) || '%')
        -- Department filter
        AND (filter_department_ids IS NULL OR pd.department_ids && filter_department_ids)
        -- Model filter
        AND (filter_model_ids IS NULL OR pd.model_ids && filter_model_ids)
        -- Status filter
        AND (filter_status IS NULL OR (pd.active AND 'true' = ANY(filter_status)) OR (NOT pd.active AND 'false' = ANY(filter_status)))
),
-- Count total filtered results (before pagination)
filtered_count AS (
    SELECT COUNT(*)::bigint as total_count FROM filtered_providers
),
-- Paginate filtered results
paginated_providers AS (
    SELECT fp.*
    FROM filtered_providers fp
    ORDER BY fp.updated_at DESC NULLS LAST
    LIMIT page_size OFFSET page_offset
),
providers_agg AS (
    SELECT
        COALESCE(
            ARRAY_AGG(
                (pp.provider_id, pp.name, pp.description, pp.value, pp.active, pp.updated_at, pp.department_ids, pp.active_model_count, pp.model_ids)::types.q_list_providers_v4_provider
                ORDER BY pp.updated_at DESC NULLS LAST
            ),
            '{}'::types.q_list_providers_v4_provider[]
        ) as providers
    FROM paginated_providers pp
),
-- Department options with names resolved in SQL
department_option_data AS (
    SELECT
        dr.id::text as value,
        (SELECT n.name FROM department_names_junction dn JOIN names_resource n ON n.id = dn.names_id WHERE dn.department_id = dd.department_id LIMIT 1) as label,
        (SELECT COUNT(*) FROM provider_data pd WHERE dr.id = ANY(pd.department_ids)) as count
    FROM departments_resource dr
    JOIN department_departments_junction dd ON dd.department_id = dr.id
    WHERE dr.id IN (SELECT department_id FROM user_departments)
      AND (department_search IS NULL OR LOWER((SELECT n.name FROM department_names_junction dn JOIN names_resource n ON n.id = dn.names_id WHERE dn.department_id = dd.department_id LIMIT 1)) LIKE '%' || LOWER(department_search) || '%')
),
-- Model options with names resolved in SQL
all_model_ids AS (
    SELECT DISTINCT unnest(model_ids) as model_id
    FROM provider_data
    WHERE model_ids IS NOT NULL AND array_length(model_ids, 1) > 0
),
model_option_data AS (
    SELECT
        ma.id::text as value,
        (SELECT n.name FROM model_names_junction mn JOIN names_resource n ON n.id = mn.names_id WHERE mn.model_id = ma.id LIMIT 1) as label,
        (SELECT COUNT(*) FROM provider_data pd WHERE ma.id = ANY(pd.model_ids)) as count
    FROM model_artifact ma
    WHERE ma.id IN (SELECT model_id FROM all_model_ids)
      AND (model_search IS NULL OR LOWER((SELECT n.name FROM model_names_junction mn JOIN names_resource n ON n.id = mn.names_id WHERE mn.model_id = ma.id LIMIT 1)) LIKE '%' || LOWER(model_search) || '%')
),
-- Status options with counts
status_option_data AS (
    SELECT * FROM (VALUES
        ('true', 'Active', (SELECT COUNT(*) FROM provider_data WHERE active = true)::bigint),
        ('false', 'Inactive', (SELECT COUNT(*) FROM provider_data WHERE active = false)::bigint)
    ) AS t(value, label, count)
)
SELECT
    pa.providers,
    -- Department options (names resolved in SQL)
    COALESCE(
        (SELECT ARRAY_AGG(
            (dod.value, dod.label, dod.count)::types.q_list_providers_v4_option
            ORDER BY dod.label
        ) FROM department_option_data dod),
        '{}'::types.q_list_providers_v4_option[]
    ) as department_options,
    -- Model options (names resolved in SQL)
    COALESCE(
        (SELECT ARRAY_AGG(
            (mod.value, mod.label, mod.count)::types.q_list_providers_v4_option
            ORDER BY mod.label
        ) FROM model_option_data mod),
        '{}'::types.q_list_providers_v4_option[]
    ) as model_options,
    -- Status options with counts
    (SELECT ARRAY_AGG(
        (sod.value, sod.label, sod.count)::types.q_list_providers_v4_option
    ) FROM status_option_data sod) as status_options,
    -- Total count
    (SELECT total_count FROM filtered_count) as total_count
FROM params
CROSS JOIN providers_agg pa
$$;
