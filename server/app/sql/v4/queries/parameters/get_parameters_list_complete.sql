-- Get parameters list with raw data for Python permission computation
-- Resource-first: only touches parameter_artifact + parameter's own junctions + resource tables
-- No cross-entity artifact tables (scenario_artifact, department_artifact, etc.)

-- 1) Drop function first (breaks dependency on types)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_list_parameters_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_list_parameters_v4(%s)', r.sig);
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
        WHERE typname LIKE 'q_list_parameters_v4_%'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I', r.typname);
    END LOOP;
END $$;

-- 3) Recreate types
CREATE TYPE types.q_list_parameters_v4_sample_item AS (
    parameter_item_id uuid,
    name text,
    description text
);

CREATE TYPE types.q_list_parameters_v4_parameter AS (
    parameter_id uuid,
    name text,
    description text,
    active boolean,
    updated_at timestamptz,
    department_ids text[],
    scenario_ids uuid[],
    num_items int,
    sample_items types.q_list_parameters_v4_sample_item[],
    -- Raw data for Python permission computation
    active_scenario_count bigint,
    total_scenario_links bigint
);

-- Filter option type: id + count only (names hydrated in Python from cache)
CREATE TYPE types.q_list_parameters_v4_option_id AS (
    id uuid,
    count bigint
);

-- 4) Recreate function
CREATE OR REPLACE FUNCTION api_list_parameters_v4(
    profile_id uuid,
    search text DEFAULT NULL,
    scenario_ids uuid[] DEFAULT NULL,
    filter_department_ids uuid[] DEFAULT NULL,
    scenario_search text DEFAULT NULL,
    department_search text DEFAULT NULL,
    page_size int DEFAULT 12,
    page_offset int DEFAULT 0
)
RETURNS TABLE (
    actor_name text,
    user_role text,
    parameters types.q_list_parameters_v4_parameter[],
    scenario_option_ids types.q_list_parameters_v4_option_id[],
    department_option_ids types.q_list_parameters_v4_option_id[],
    total_count bigint
)
LANGUAGE sql
STABLE
AS $$
WITH params AS (
    SELECT profile_id AS profile_id
),
user_departments AS (
    SELECT pd.department_id
    FROM params x
    JOIN profile_departments_junction pd ON pd.profile_id = x.profile_id AND pd.active = true
),
user_profile AS (
    SELECT role, COALESCE(NULLIF(actor_name, ''), 'System') as actor_name
    FROM view_user_profile_context
    WHERE profile_id = (SELECT profile_id FROM params)
),
-- Scenario linkage via denormalized scenarios_resource.parameter_ids
-- parameter_artifact → parameter_parameters_junction → parameters_resource → scenarios_resource WHERE parameter_ids @> ARRAY[parameters_resource.id]
parameter_scenarios AS (
    SELECT
        ppj.parameter_id,
        ARRAY_AGG(DISTINCT sr.id) as scenario_ids,
        COUNT(DISTINCT sr.id)::int as num_scenarios
    FROM parameter_parameters_junction ppj
    JOIN parameters_resource pr ON pr.id = ppj.parameters_id
    JOIN scenarios_resource sr ON pr.id = ANY(sr.parameter_ids)
    GROUP BY ppj.parameter_id
),
-- Active scenario count (for edit permission - scenarios with active flag)
parameter_active_scenario_links AS (
    SELECT
        ppj.parameter_id,
        COUNT(DISTINCT sr.id) as active_scenario_count
    FROM parameter_parameters_junction ppj
    JOIN parameters_resource pr ON pr.id = ppj.parameters_id
    JOIN scenarios_resource sr ON pr.id = ANY(sr.parameter_ids)
    JOIN scenario_scenarios_junction ssj ON ssj.scenarios_id = sr.id
    JOIN scenario_flags_junction sf ON sf.scenario_id = ssj.scenario_id
    JOIN flags_resource f ON sf.flag_id = f.id AND f.name = 'scenario_active' AND sf.value = true
    GROUP BY ppj.parameter_id
),
-- Total scenario links (for delete permission - any scenario link)
parameter_all_scenario_links AS (
    SELECT
        ppj.parameter_id,
        COUNT(DISTINCT sr.id) as total_scenario_links
    FROM parameter_parameters_junction ppj
    JOIN parameters_resource pr ON pr.id = ppj.parameters_id
    JOIN scenarios_resource sr ON pr.id = ANY(sr.parameter_ids)
    GROUP BY ppj.parameter_id
),
parameter_departments_data AS (
    SELECT
        pd.parameter_id,
        ARRAY_AGG(pd.department_id::text ORDER BY pd.created_at) as department_ids
    FROM parameter_departments_junction pd
    WHERE pd.active = true
    GROUP BY pd.parameter_id
),
parameter_item_counts AS (
    SELECT
        pfj.parameter_id,
        COUNT(DISTINCT pfj.field_id) as num_items
    FROM parameter_fields_junction pfj
    JOIN field_flags_junction ff ON ff.field_id = pfj.field_id
    JOIN flags_resource fl ON ff.flag_id = fl.id AND fl.name = 'field_active' AND ff.value = true
    GROUP BY pfj.parameter_id
),
parameter_sample_items_data AS (
    SELECT
        f_sub.parameter_id,
        f_sub.field_id,
        f_sub.name,
        f_sub.description
    FROM (
        SELECT
            pfj.parameter_id,
            pfj.field_id,
            (SELECT n.name FROM field_names_junction fn JOIN names_resource n ON fn.name_id = n.id WHERE fn.field_id = pfj.field_id LIMIT 1) as name,
            (SELECT d.description FROM field_descriptions_junction fd JOIN descriptions_resource d ON fd.description_id = d.id WHERE fd.field_id = pfj.field_id LIMIT 1) as description,
            ROW_NUMBER() OVER (PARTITION BY pfj.parameter_id ORDER BY (SELECT n.name FROM field_names_junction fn JOIN names_resource n ON fn.name_id = n.id WHERE fn.field_id = pfj.field_id LIMIT 1)) as rn
        FROM parameter_fields_junction pfj
        JOIN field_flags_junction ff ON ff.field_id = pfj.field_id
        JOIN flags_resource fl ON ff.flag_id = fl.id AND fl.name = 'field_active' AND ff.value = true
    ) f_sub
    WHERE f_sub.rn <= 3
),
parameter_data_base AS (
    SELECT
        p.id as parameter_id,
        (SELECT n.name FROM parameter_names_junction pn JOIN names_resource n ON pn.name_id = n.id WHERE pn.parameter_id = p.id LIMIT 1) as parameter_name,
        (SELECT d.description FROM parameter_descriptions_junction pd JOIN descriptions_resource d ON pd.description_id = d.id WHERE pd.parameter_id = p.id LIMIT 1) as description,
        EXISTS (SELECT 1 FROM parameter_flags_junction pf JOIN flags_resource f ON pf.flag_id = f.id WHERE pf.parameter_id = p.id AND f.name = 'parameter_active' AND pf.value = TRUE) as active,
        p.updated_at,
        COALESCE(pdd.department_ids, NULL) as department_ids,
        COALESCE(ps.scenario_ids, ARRAY[]::uuid[]) as scenario_ids,
        COALESCE(pic.num_items, 0)::int as num_items,
        COALESCE(
            (SELECT ARRAY_AGG((psi.field_id, psi.name, psi.description)::types.q_list_parameters_v4_sample_item ORDER BY psi.name)
             FROM parameter_sample_items_data psi
             WHERE psi.parameter_id = p.id),
            '{}'::types.q_list_parameters_v4_sample_item[]
        ) as sample_items,
        COALESCE(pasl.active_scenario_count, 0)::bigint as active_scenario_count,
        COALESCE(pasl_all.total_scenario_links, 0)::bigint as total_scenario_links
    FROM parameter_artifact p
    LEFT JOIN parameter_scenarios ps ON ps.parameter_id = p.id
    LEFT JOIN parameter_departments_data pdd ON pdd.parameter_id = p.id
    LEFT JOIN parameter_item_counts pic ON pic.parameter_id = p.id
    LEFT JOIN parameter_active_scenario_links pasl ON pasl.parameter_id = p.id
    LEFT JOIN parameter_all_scenario_links pasl_all ON pasl_all.parameter_id = p.id
    LEFT JOIN parameter_departments_junction pd ON pd.parameter_id = p.id AND pd.active = true AND pd.department_id IN (SELECT department_id FROM user_departments)
    GROUP BY p.id,
        (SELECT n.name FROM parameter_names_junction pn JOIN names_resource n ON pn.name_id = n.id WHERE pn.parameter_id = p.id LIMIT 1),
        (SELECT d.description FROM parameter_descriptions_junction pd JOIN descriptions_resource d ON pd.description_id = d.id WHERE pd.parameter_id = p.id LIMIT 1),
        EXISTS (SELECT 1 FROM parameter_flags_junction pf JOIN flags_resource f ON pf.flag_id = f.id WHERE pf.parameter_id = p.id AND f.name = 'parameter_active' AND pf.value = TRUE),
        p.updated_at,
        pdd.department_ids, ps.scenario_ids, pic.num_items,
        pasl.active_scenario_count, pasl_all.total_scenario_links
    HAVING COUNT(pd.parameter_id) > 0 OR NOT EXISTS (
        SELECT 1 FROM parameter_departments_junction pd2 WHERE pd2.parameter_id = p.id AND pd2.active = true
    )
),
parameter_data AS (
    SELECT pdb.*
    FROM parameter_data_base pdb
),
-- Apply server-side filters
filtered_parameters AS (
    SELECT pd.*
    FROM parameter_data pd
    WHERE
        -- Search filter: match name or description (case-insensitive)
        (search IS NULL OR LOWER(pd.parameter_name) LIKE '%' || LOWER(search) || '%' OR LOWER(pd.description) LIKE '%' || LOWER(search) || '%')
        -- Scenario filter: parameter must be linked to at least one selected scenario
        AND (api_list_parameters_v4.scenario_ids IS NULL OR pd.scenario_ids && api_list_parameters_v4.scenario_ids)
        -- Department filter: parameter must belong to at least one selected department
        AND (filter_department_ids IS NULL OR pd.department_ids && filter_department_ids::text[])
),
-- Count total filtered results (before pagination)
filtered_count AS (
    SELECT COUNT(*)::bigint as total_count FROM filtered_parameters
),
-- Paginate filtered results
paginated_parameters AS (
    SELECT fp.*
    FROM filtered_parameters fp
    ORDER BY fp.updated_at DESC NULLS LAST
    LIMIT page_size OFFSET page_offset
),
-- Filter option IDs with counts (names hydrated in Python from cached *_internal() functions)
all_scenario_ids AS (
    SELECT DISTINCT unnest(scenario_ids) as scenario_id
    FROM parameter_data
),
scenario_option_data AS (
    SELECT
        sr.id,
        (SELECT COUNT(*) FROM parameter_data pd WHERE sr.id = ANY(pd.scenario_ids)) as count
    FROM scenarios_resource sr
    WHERE sr.id IN (SELECT scenario_id FROM all_scenario_ids)
),
department_option_data AS (
    SELECT
        dr.id,
        (SELECT COUNT(*) FROM parameter_data) as count
    FROM departments_resource dr
    WHERE dr.id IN (SELECT department_id FROM user_departments)
)
SELECT
    up.actor_name::text as actor_name,
    up.role::text as user_role,
    -- Aggregate paginated parameters
    COALESCE(
        (SELECT ARRAY_AGG(
            (pd.parameter_id, pd.parameter_name, pd.description, pd.active, pd.updated_at,
             pd.department_ids, pd.scenario_ids, pd.num_items,
             pd.sample_items, pd.active_scenario_count, pd.total_scenario_links
            )::types.q_list_parameters_v4_parameter
            ORDER BY pd.updated_at DESC NULLS LAST
        ) FROM paginated_parameters pd),
        '{}'::types.q_list_parameters_v4_parameter[]
    ) as parameters,
    -- Scenario option IDs with counts (names hydrated in Python)
    COALESCE(
        (SELECT ARRAY_AGG(
            (sod.id, sod.count)::types.q_list_parameters_v4_option_id
        ) FROM scenario_option_data sod),
        '{}'::types.q_list_parameters_v4_option_id[]
    ) as scenario_option_ids,
    -- Department option IDs with counts (names hydrated in Python)
    COALESCE(
        (SELECT ARRAY_AGG(
            (dod.id, dod.count)::types.q_list_parameters_v4_option_id
        ) FROM department_option_data dod),
        '{}'::types.q_list_parameters_v4_option_id[]
    ) as department_option_ids,
    -- Total count of filtered parameters (before pagination)
    (SELECT total_count FROM filtered_count) as total_count
FROM user_profile up
$$;
