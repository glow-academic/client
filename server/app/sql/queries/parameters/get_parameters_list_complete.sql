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

-- 2) Drop types in reverse dependency order (parameter depends on sample_item)
DROP TYPE IF EXISTS types.q_list_parameters_v4_parameter;
DROP TYPE IF EXISTS types.q_list_parameters_v4_option_id;
DROP TYPE IF EXISTS types.q_list_parameters_v4_option;
DROP TYPE IF EXISTS types.q_list_parameters_v4_sample_item;

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
    active_scenario_count bigint
);

-- Filter option type: value/label/count (names resolved in SQL)
CREATE TYPE types.q_list_parameters_v4_option AS (
    value text,
    label text,
    count bigint
);

-- 4) Recreate function
CREATE OR REPLACE FUNCTION api_list_parameters_v4(
    profile_id uuid,
    search text DEFAULT NULL,
    scenario_ids uuid[] DEFAULT NULL,
    filter_department_ids uuid[] DEFAULT NULL,
    field_ids uuid[] DEFAULT NULL,
    scenario_search text DEFAULT NULL,
    field_search text DEFAULT NULL,
    department_search text DEFAULT NULL,
    page_size int DEFAULT 12,
    page_offset int DEFAULT 0
)
RETURNS TABLE (
    parameters types.q_list_parameters_v4_parameter[],
    scenario_options types.q_list_parameters_v4_option[],
    field_options types.q_list_parameters_v4_option[],
    department_options types.q_list_parameters_v4_option[],
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
    SELECT pd.departments_id
    FROM params x
    JOIN profile_departments_junction pd ON pd.profile_id = x.profile_id AND pd.active = true
),
-- Scenario linkage via parameter_fields_resource → scenarios_resource.parameter_field_ids
-- parameter_artifact → parameter_parameters_junction → parameters_resource → parameter_fields_resource → scenarios_resource
parameter_scenarios AS (
    SELECT
        ppj.parameter_id,
        ARRAY_AGG(DISTINCT sr.id) as scenario_ids,
        COUNT(DISTINCT sr.id)::int as num_scenarios
    FROM parameter_parameters_junction ppj
    JOIN parameters_resource pr ON pr.id = ppj.parameters_id
    JOIN parameter_fields_resource pfr ON pfr.parameter_id = pr.id
    JOIN scenarios_resource sr ON pfr.id = ANY(sr.parameter_field_ids)
    GROUP BY ppj.parameter_id
),
-- Active scenario count (for edit permission - scenarios with active flag)
parameter_active_scenario_links AS (
    SELECT
        ppj.parameter_id,
        COUNT(DISTINCT sr.id) as active_scenario_count
    FROM parameter_parameters_junction ppj
    JOIN parameters_resource pr ON pr.id = ppj.parameters_id
    JOIN parameter_fields_resource pfr ON pfr.parameter_id = pr.id
    JOIN scenarios_resource sr ON pfr.id = ANY(sr.parameter_field_ids)
    JOIN scenario_scenarios_junction ssj ON ssj.scenario_id = sr.id
    JOIN scenario_flags_junction sf ON sf.scenario_id = ssj.scenario_id
    JOIN flags_resource f ON sf.flags_id = f.id AND f.type = 'scenario_active' AND f.value = true
    GROUP BY ppj.parameter_id
),
parameter_departments_data AS (
    SELECT
        pd.parameter_id,
        ARRAY_AGG(pd.departments_id::text ORDER BY pd.created_at) as department_ids
    FROM parameter_departments_junction pd
    WHERE pd.active = true
    GROUP BY pd.parameter_id
),
-- Field linkage via parameter_fields_junction
parameter_fields_agg AS (
    SELECT
        pfj.parameter_id,
        ARRAY_AGG(DISTINCT pfj.field_id) as field_ids
    FROM parameter_fields_junction pfj
    JOIN field_flags_junction ff ON ff.field_id = pfj.field_id
    JOIN flags_resource fl ON ff.flags_id = fl.id AND fl.name = 'field_active' AND fl.value = true
    GROUP BY pfj.parameter_id
),
parameter_item_counts AS (
    SELECT
        pfj.parameter_id,
        COUNT(DISTINCT pfj.field_id) as num_items
    FROM parameter_fields_junction pfj
    JOIN field_flags_junction ff ON ff.field_id = pfj.field_id
    JOIN flags_resource fl ON ff.flags_id = fl.id AND fl.name = 'field_active' AND fl.value = true
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
            (SELECT n.name FROM field_names_junction fn JOIN names_resource n ON fn.names_id = n.id WHERE fn.field_id = pfj.field_id LIMIT 1) as name,
            (SELECT d.description FROM field_descriptions_junction fd JOIN descriptions_resource d ON fd.descriptions_id = d.id WHERE fd.field_id = pfj.field_id LIMIT 1) as description,
            ROW_NUMBER() OVER (PARTITION BY pfj.parameter_id ORDER BY (SELECT n.name FROM field_names_junction fn JOIN names_resource n ON fn.names_id = n.id WHERE fn.field_id = pfj.field_id LIMIT 1)) as rn
        FROM parameter_fields_junction pfj
        JOIN field_flags_junction ff ON ff.field_id = pfj.field_id
        JOIN flags_resource fl ON ff.flags_id = fl.id AND fl.name = 'field_active' AND fl.value = true
    ) f_sub
    WHERE f_sub.rn <= 3
),
parameter_data_base AS (
    SELECT
        p.id as parameter_id,
        (SELECT n.name FROM parameter_names_junction pn JOIN names_resource n ON pn.names_id = n.id WHERE pn.parameter_id = p.id LIMIT 1) as parameter_name,
        (SELECT d.description FROM parameter_descriptions_junction pd JOIN descriptions_resource d ON pd.descriptions_id = d.id WHERE pd.parameter_id = p.id LIMIT 1) as description,
        EXISTS (SELECT 1 FROM parameter_flags_junction pf JOIN flags_resource f ON pf.flags_id = f.id WHERE pf.parameter_id = p.id AND f.name = 'parameter_active' AND f.value = TRUE) as active,
        p.updated_at,
        COALESCE(pdd.department_ids, NULL) as department_ids,
        COALESCE(ps.scenario_ids, ARRAY[]::uuid[]) as scenario_ids,
        COALESCE(pfa.field_ids, ARRAY[]::uuid[]) as field_ids,
        COALESCE(pic.num_items, 0)::int as num_items,
        COALESCE(
            (SELECT ARRAY_AGG((psi.field_id, psi.name, psi.description)::types.q_list_parameters_v4_sample_item ORDER BY psi.name)
             FROM parameter_sample_items_data psi
             WHERE psi.parameter_id = p.id),
            '{}'::types.q_list_parameters_v4_sample_item[]
        ) as sample_items,
        COALESCE(pasl.active_scenario_count, 0)::bigint as active_scenario_count
    FROM parameter_artifact p
    LEFT JOIN parameter_scenarios ps ON ps.parameter_id = p.id
    LEFT JOIN parameter_departments_data pdd ON pdd.parameter_id = p.id
    LEFT JOIN parameter_fields_agg pfa ON pfa.parameter_id = p.id
    LEFT JOIN parameter_item_counts pic ON pic.parameter_id = p.id
    LEFT JOIN parameter_active_scenario_links pasl ON pasl.parameter_id = p.id
    LEFT JOIN parameter_departments_junction pd ON pd.parameter_id = p.id AND pd.active = true AND pd.departments_id IN (SELECT departments_id FROM user_departments)
    GROUP BY p.id,
        (SELECT n.name FROM parameter_names_junction pn JOIN names_resource n ON pn.names_id = n.id WHERE pn.parameter_id = p.id LIMIT 1),
        (SELECT d.description FROM parameter_descriptions_junction pd JOIN descriptions_resource d ON pd.descriptions_id = d.id WHERE pd.parameter_id = p.id LIMIT 1),
        EXISTS (SELECT 1 FROM parameter_flags_junction pf JOIN flags_resource f ON pf.flags_id = f.id WHERE pf.parameter_id = p.id AND f.name = 'parameter_active' AND f.value = TRUE),
        p.updated_at,
        pdd.department_ids, ps.scenario_ids, pfa.field_ids, pic.num_items,
        pasl.active_scenario_count
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
        -- Field filter: parameter must contain at least one selected field
        AND (api_list_parameters_v4.field_ids IS NULL OR pd.field_ids && api_list_parameters_v4.field_ids)
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
-- Filter options with value/label/count (names resolved in SQL)
all_scenario_ids AS (
    SELECT DISTINCT unnest(scenario_ids) as scenario_id
    FROM parameter_data
),
all_field_ids AS (
    SELECT DISTINCT unnest(field_ids) as field_id
    FROM parameter_data
    WHERE field_ids IS NOT NULL AND array_length(field_ids, 1) > 0
),
all_department_ids AS (
    SELECT DISTINCT departments_id AS department_id
    FROM user_departments
)
SELECT
    -- Aggregate paginated parameters
    COALESCE(
        (SELECT ARRAY_AGG(
            (pd.parameter_id, pd.parameter_name, pd.description, pd.active, pd.updated_at,
             pd.department_ids, pd.scenario_ids, pd.num_items,
             pd.sample_items, pd.active_scenario_count
            )::types.q_list_parameters_v4_parameter
            ORDER BY pd.updated_at DESC NULLS LAST
        ) FROM paginated_parameters pd),
        '{}'::types.q_list_parameters_v4_parameter[]
    ) as parameters,
    -- Scenario filter options (value/label/count resolved in SQL)
    COALESCE(
        (SELECT ARRAY_AGG(
            (sr.id::text, sn_name.name, (SELECT COUNT(*) FROM parameter_data pd WHERE sr.id = ANY(pd.scenario_ids)))::types.q_list_parameters_v4_option
            ORDER BY sn_name.name
         )
         FROM scenarios_resource sr
         JOIN scenario_scenarios_junction ssj ON ssj.scenario_id = sr.id
         JOIN (SELECT sn.scenario_id, n.name FROM scenario_names_junction sn JOIN names_resource n ON sn.names_id = n.id) sn_name ON sn_name.scenario_id = ssj.scenario_id
         WHERE sr.id IN (SELECT scenario_id FROM all_scenario_ids)
           AND (scenario_search IS NULL OR LOWER(sn_name.name) LIKE '%' || LOWER(scenario_search) || '%')),
        '{}'::types.q_list_parameters_v4_option[]
    ) as scenario_options,
    -- Field filter options (value/label/count resolved in SQL)
    COALESCE(
        (SELECT ARRAY_AGG(
            (fr.id::text, fn_name.name, (SELECT COUNT(*) FROM parameter_data pd WHERE fr.id = ANY(pd.field_ids)))::types.q_list_parameters_v4_option
            ORDER BY fn_name.name
         )
         FROM fields_resource fr
         JOIN field_fields_junction ffj ON ffj.fields_id = fr.id
         JOIN (SELECT fn.field_id, n.name FROM field_names_junction fn JOIN names_resource n ON fn.names_id = n.id) fn_name ON fn_name.field_id = ffj.field_id
         WHERE fr.id IN (SELECT field_id FROM all_field_ids)
           AND (field_search IS NULL OR LOWER(fn_name.name) LIKE '%' || LOWER(field_search) || '%')),
        '{}'::types.q_list_parameters_v4_option[]
    ) as field_options,
    -- Department filter options (value/label/count resolved in SQL)
    COALESCE(
        (SELECT ARRAY_AGG(
            (dr.id::text, dn_name.name, (SELECT COUNT(*) FROM parameter_data pd WHERE dr.id::text = ANY(pd.department_ids)))::types.q_list_parameters_v4_option
            ORDER BY dn_name.name
         )
         FROM departments_resource dr
         JOIN department_departments_junction ddj ON ddj.department_id = dr.id
         JOIN (SELECT dn.department_id, n.name FROM department_names_junction dn JOIN names_resource n ON dn.names_id = n.id) dn_name ON dn_name.department_id = ddj.department_id
         WHERE dr.id IN (SELECT department_id FROM all_department_ids)
           AND (department_search IS NULL OR LOWER(dn_name.name) LIKE '%' || LOWER(department_search) || '%')),
        '{}'::types.q_list_parameters_v4_option[]
    ) as department_options,
    -- Total count of filtered parameters (before pagination)
    (SELECT total_count FROM filtered_count) as total_count
FROM params
$$;

