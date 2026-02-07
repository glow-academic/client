-- Get parameters list with raw data for Python permission computation
-- SQL returns raw data (user_role, active_scenario_count, total_scenario_links per parameter)
-- Python computes can_edit, can_delete, can_duplicate from these

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

-- 2) Drop types WITHOUT CASCADE (drop parameter type first since it depends on sample_item)
DROP TYPE IF EXISTS types.q_list_parameters_v4_parameter;
DROP TYPE IF EXISTS types.q_list_parameters_v4_sample_item;
DROP TYPE IF EXISTS types.q_list_parameters_v4_scenario;
DROP TYPE IF EXISTS types.q_list_parameters_v4_department;

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
    scenario_ids text[],
    num_items int,
    sample_items types.q_list_parameters_v4_sample_item[],
    -- Raw data for Python permission computation
    active_scenario_count bigint,
    total_scenario_links bigint
);

CREATE TYPE types.q_list_parameters_v4_scenario AS (
    scenario_id uuid,
    name text,
    description text,
    active boolean,
    parameter_item_ids uuid[],
    count int
);

CREATE TYPE types.q_list_parameters_v4_department AS (
    department_id uuid,
    name text,
    description text,
    count int
);

-- 4) Recreate function
CREATE OR REPLACE FUNCTION api_list_parameters_v4(profile_id uuid)
RETURNS TABLE (
    actor_name text,
    user_role text,
    parameters types.q_list_parameters_v4_parameter[],
    scenarios types.q_list_parameters_v4_scenario[],
    departments types.q_list_parameters_v4_department[],
    total_count int
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
parameter_active_scenario_links AS (
    SELECT
        pfr.parameter_id,
        COUNT(DISTINCT spf.scenario_id) as active_scenario_count
    FROM parameter_fields_resource pfr
    JOIN scenario_parameter_fields_junction spf ON spf.parameter_field_id = pfr.id AND spf.active = true
    WHERE pfr.parameter_id IS NOT NULL
    GROUP BY pfr.parameter_id
),
parameter_all_scenario_links AS (
    SELECT
        pfr.parameter_id,
        COUNT(DISTINCT spf.scenario_id) as total_scenario_links
    FROM parameter_fields_resource pfr
    JOIN scenario_parameter_fields_junction spf ON spf.parameter_field_id = pfr.id
    WHERE pfr.parameter_id IS NOT NULL
    GROUP BY pfr.parameter_id
),
scenario_parameters_data AS (
    SELECT
        sp.parameter_id,
        ARRAY_AGG(DISTINCT st.parent_id::text ORDER BY st.parent_id::text) as scenario_ids,
        COUNT(DISTINCT st.parent_id) as num_scenarios
    FROM scenario_parameters_junction sp
    JOIN scenarios_resource s ON s.id = sp.scenario_id
    JOIN scenario_tree_junction st ON st.child_id = s.id AND st.parent_id = st.child_id
    WHERE sp.active = true AND EXISTS (SELECT 1 FROM scenario_flags_junction sf JOIN flags_resource f ON sf.flag_id = f.id WHERE sf.scenario_id = s.id AND f.name = 'scenario_active' AND sf.value = true)
    GROUP BY sp.parameter_id
),
parameter_item_counts AS (
    SELECT
        (SELECT pf.parameter_id FROM parameter_fields_junction pf WHERE pf.field_id = f.id LIMIT 1),
        COUNT(*) as num_items
    FROM field_artifact f
    WHERE EXISTS (SELECT 1 FROM field_flags_junction ff JOIN flags_resource f ON ff.flag_id = f.id WHERE ff.field_id = f.id AND f.name = 'field_active' AND ff.value = true) AND (SELECT pf.parameter_id FROM parameter_fields_junction pf WHERE pf.field_id = f.id LIMIT 1) IS NOT NULL
    GROUP BY (SELECT pf.parameter_id FROM parameter_fields_junction pf WHERE pf.field_id = f.id LIMIT 1)
),
parameter_sample_items_data AS (
    SELECT
        f_sub.parameter_id,
        f_sub.field_id,
        f_sub.name,
        f_sub.description
    FROM (
        SELECT f.id as field_id, (SELECT pf.parameter_id FROM parameter_fields_junction pf WHERE pf.field_id = f.id LIMIT 1), (SELECT n.name FROM field_names_junction fn JOIN names_resource n ON fn.name_id = n.id WHERE fn.field_id = f.id LIMIT 1), (SELECT d.description FROM field_descriptions_junction fd JOIN descriptions_resource d ON fd.description_id = d.id WHERE fd.field_id = f.id LIMIT 1),
               ROW_NUMBER() OVER (PARTITION BY (SELECT pf.parameter_id FROM parameter_fields_junction pf WHERE pf.field_id = f.id LIMIT 1) ORDER BY (SELECT n.name FROM field_names_junction fn JOIN names_resource n ON fn.name_id = n.id WHERE fn.field_id = f.id LIMIT 1)) as rn
        FROM field_artifact f
        WHERE EXISTS (SELECT 1 FROM field_flags_junction ff JOIN flags_resource f ON ff.flag_id = f.id WHERE ff.field_id = f.id AND f.name = 'field_active' AND ff.value = true) AND (SELECT pf.parameter_id FROM parameter_fields_junction pf WHERE pf.field_id = f.id LIMIT 1) IS NOT NULL
    ) f_sub
    WHERE f_sub.rn <= 3
),
parameter_item_departments_data AS (
    SELECT
        combined.parameter_id,
        ARRAY_AGG(DISTINCT combined.department_id::text ORDER BY combined.department_id::text) as department_ids
    FROM (
        SELECT pd.parameter_id, pd.department_id
        FROM parameter_departments_junction pd
        WHERE pd.active = true
        UNION
        SELECT (SELECT pf.parameter_id FROM parameter_fields_junction pf WHERE pf.field_id = f.id LIMIT 1), fd.department_id
        FROM field_artifact f
        JOIN field_departments_junction fd ON fd.field_id = f.id
        WHERE EXISTS (SELECT 1 FROM field_flags_junction ff JOIN flags_resource f ON ff.flag_id = f.id WHERE ff.field_id = f.id AND f.name = 'field_active' AND ff.value = true) AND fd.active = true AND (SELECT pf.parameter_id FROM parameter_fields_junction pf WHERE pf.field_id = f.id LIMIT 1) IS NOT NULL
    ) combined
    GROUP BY combined.parameter_id
),
parameter_item_departments_for_filter AS (
    SELECT DISTINCT
        combined.parameter_id,
        combined.department_id
    FROM (
        SELECT pd.parameter_id, pd.department_id
        FROM parameter_departments_junction pd
        WHERE pd.active = true
        UNION
        SELECT (SELECT pf.parameter_id FROM parameter_fields_junction pf WHERE pf.field_id = f.id LIMIT 1), fd.department_id
        FROM field_artifact f
        JOIN field_departments_junction fd ON fd.field_id = f.id
        WHERE EXISTS (SELECT 1 FROM field_flags_junction ff JOIN flags_resource f ON ff.flag_id = f.id WHERE ff.field_id = f.id AND f.name = 'field_active' AND ff.value = true) AND fd.active = true AND (SELECT pf.parameter_id FROM parameter_fields_junction pf WHERE pf.field_id = f.id LIMIT 1) IS NOT NULL
    ) combined
),
filtered_parameters AS (
    SELECT
        p.id,
        (SELECT n.name FROM parameter_names_junction pn JOIN names_resource n ON pn.name_id = n.id WHERE pn.parameter_id = p.id LIMIT 1),
        (SELECT d.description FROM parameter_descriptions_junction pd JOIN descriptions_resource d ON pd.description_id = d.id WHERE pd.parameter_id = p.id LIMIT 1),
        EXISTS (SELECT 1 FROM parameter_flags_junction pf JOIN flags_resource f ON pf.flag_id = f.id WHERE pf.parameter_id = p.id AND f.name = 'parameter_active' AND pf.value = TRUE) as active,
        p.updated_at
    FROM parameter_artifact p
    LEFT JOIN parameter_item_departments_for_filter pidf ON pidf.parameter_id = p.id
    GROUP BY p.id, (SELECT n.name FROM parameter_names_junction pn JOIN names_resource n ON pn.name_id = n.id WHERE pn.parameter_id = p.id LIMIT 1), (SELECT d.description FROM parameter_descriptions_junction pd JOIN descriptions_resource d ON pd.description_id = d.id WHERE pd.parameter_id = p.id LIMIT 1), EXISTS (SELECT 1 FROM parameter_flags_junction pf JOIN flags_resource f ON pf.flag_id = f.id WHERE pf.parameter_id = p.id AND f.name = 'parameter_active' AND pf.value = TRUE), p.updated_at
    HAVING
        COUNT(pidf.parameter_id) FILTER (WHERE pidf.department_id IN (SELECT department_id FROM user_departments)) > 0
        OR NOT EXISTS (
            SELECT 1 FROM parameter_departments_junction pd2 WHERE pd2.parameter_id = p.id AND pd2.active = true
        )
        AND NOT EXISTS (
            SELECT 1 FROM field_departments_junction fd2
            JOIN fields_resource f2 ON f2.id = fd2.field_id
            JOIN parameter_fields_junction pf2 ON pf2.field_id = f2.id WHERE pf2.parameter_id = p.id AND EXISTS (SELECT 1 FROM field_flags_junction ff2 JOIN flags_resource fl2 ON ff2.flag_id = fl2.id WHERE ff2.field_id = f2.id AND fl2.name = 'field_active' AND ff2.value = TRUE) AND fd2.active = true
        )
),
all_department_ids AS (
    SELECT DISTINCT unnest(department_ids)::uuid as department_id
    FROM parameter_item_departments_data
    WHERE department_ids IS NOT NULL
    UNION
    SELECT ud.department_id FROM user_departments ud
),
all_scenario_ids AS (
    SELECT DISTINCT unnest(scenario_ids)::uuid as scenario_id
    FROM scenario_parameters_data
    WHERE scenario_ids IS NOT NULL
),
scenarios_data AS (
    SELECT
        s.id as scenario_id,
        (SELECT n.name FROM scenario_names_junction sn JOIN names_resource n ON sn.name_id = n.id WHERE sn.scenario_id = ssj.scenario_id LIMIT 1),
        COALESCE(ps.problem_statement, '') as description,
        EXISTS (SELECT 1 FROM scenario_flags_junction sf JOIN flags_resource f ON sf.flag_id = f.id WHERE sf.scenario_id = s.id AND f.name = 'scenario_active' AND sf.value = TRUE) as active,
        -- Parameter field IDs linked to this scenario
        COALESCE(
            (SELECT ARRAY_AGG(DISTINCT spfj.parameter_field_id)
             FROM scenario_parameter_fields_junction spfj
             WHERE spfj.scenario_id = s.id AND spfj.active = true),
            ARRAY[]::uuid[]
        ) as parameter_item_ids,
        -- Count of parameters linked to this scenario
        COALESCE(
            (SELECT COUNT(DISTINCT sp.parameter_id)::int
             FROM scenario_parameters_junction sp
             WHERE sp.scenario_id = s.id AND sp.active = true),
            0
        ) as count
    FROM all_scenario_ids asi
    LEFT JOIN scenarios_resource s ON s.id = asi.scenario_id
    LEFT JOIN scenario_scenarios_junction ssj ON ssj.scenarios_id = s.id
    LEFT JOIN scenario_problem_statements_junction sps ON sps.scenario_id = s.id AND sps.active = true
    LEFT JOIN problem_statements_resource ps ON ps.id = sps.problem_statement_id
    WHERE s.id IS NOT NULL
),
departments_data AS (
    SELECT
        d.id as department_id,
        (SELECT n.name FROM department_names_junction dn JOIN names_resource n ON dn.name_id = n.id WHERE dn.department_id = d.id LIMIT 1) as name,
        COALESCE((SELECT d_desc.description FROM department_descriptions_junction dd JOIN descriptions_resource d_desc ON d_desc.id = dd.description_id WHERE dd.department_id = d.id LIMIT 1), '') as description,
        -- Count of parameters in this department
        COALESCE(
            (SELECT COUNT(DISTINCT pidd.parameter_id)::int
             FROM parameter_item_departments_data pidd
             WHERE pidd.department_ids @> ARRAY[d.id::text]),
            0
        ) as count
    FROM department_artifact d
    WHERE d.id IN (SELECT department_id FROM all_department_ids)
),
-- Collect department IDs actually assigned to parameters
assigned_department_ids AS (
    SELECT DISTINCT unnest(pidd.department_ids)::uuid as department_id
    FROM filtered_parameters fp
    LEFT JOIN parameter_item_departments_data pidd ON pidd.parameter_id = fp.id
    WHERE pidd.department_ids IS NOT NULL
),
-- Filter departments to only include those assigned to parameters AND in user's departments
filtered_departments_data AS (
    SELECT
        d.department_id,
        d.name,
        d.description,
        d.count
    FROM departments_data d
    WHERE d.department_id IN (SELECT department_id FROM assigned_department_ids)
    AND d.department_id IN (SELECT department_id FROM user_departments)
),
parameters_data AS (
    SELECT
        fp.id as parameter_id,
        fp.name,
        fp.description,
        fp.active,
        fp.updated_at,
        COALESCE(pidd.department_ids, NULL) as department_ids,
        COALESCE(spd.scenario_ids, ARRAY[]::text[]) as scenario_ids,
        COALESCE(pic.num_items, 0) as num_items,
        COALESCE(
            (SELECT ARRAY_AGG((psi.field_id, psi.name, psi.description)::types.q_list_parameters_v4_sample_item ORDER BY psi.name)
             FROM parameter_sample_items_data psi
             WHERE psi.parameter_id = fp.id),
            '{}'::types.q_list_parameters_v4_sample_item[]
        ) as sample_items,
        -- Raw data for Python permission computation (replaces SQL-computed can_edit/can_delete/can_duplicate)
        COALESCE(pasl.active_scenario_count, 0)::bigint as active_scenario_count,
        COALESCE(pasl_all.total_scenario_links, 0)::bigint as total_scenario_links
    FROM filtered_parameters fp
    LEFT JOIN parameter_item_departments_data pidd ON pidd.parameter_id = fp.id
    LEFT JOIN scenario_parameters_data spd ON spd.parameter_id = fp.id
    LEFT JOIN parameter_item_counts pic ON pic.parameter_id = fp.id
    LEFT JOIN parameter_active_scenario_links pasl ON pasl.parameter_id = fp.id
    LEFT JOIN parameter_all_scenario_links pasl_all ON pasl_all.parameter_id = fp.id
)
SELECT
    up.actor_name::text as actor_name,
    up.role::text as user_role,
    -- Aggregate parameters separately
    COALESCE(
        (SELECT ARRAY_AGG(
            (pd.parameter_id, pd.name, pd.description, pd.active, pd.updated_at,
             pd.department_ids, pd.scenario_ids, pd.num_items,
             pd.sample_items, pd.active_scenario_count, pd.total_scenario_links
            )::types.q_list_parameters_v4_parameter
            ORDER BY pd.updated_at DESC NULLS LAST
        ) FROM parameters_data pd),
        '{}'::types.q_list_parameters_v4_parameter[]
    ) as parameters,
    -- Aggregate scenarios separately
    COALESCE(
        (SELECT ARRAY_AGG(
            (sd.scenario_id, sd.name, sd.description, sd.active, sd.parameter_item_ids, sd.count)::types.q_list_parameters_v4_scenario
            ORDER BY sd.name
        ) FROM scenarios_data sd),
        '{}'::types.q_list_parameters_v4_scenario[]
    ) as scenarios,
    -- Aggregate departments separately
    COALESCE(
        (SELECT ARRAY_AGG(
            (fdd.department_id, fdd.name, fdd.description, fdd.count)::types.q_list_parameters_v4_department
            ORDER BY fdd.name
        ) FROM filtered_departments_data fdd),
        '{}'::types.q_list_parameters_v4_department[]
    ) as departments,
    -- Total count of parameters
    COALESCE(
        (SELECT COUNT(*)::int FROM parameters_data),
        0
    ) as total_count
FROM user_profile up
$$;
