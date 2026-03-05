-- Get rubrics list - resource-first pattern
-- SQL returns minimal data (entity data + option IDs with counts for filters)
-- Python computes permissions from permissions.py
-- Server-side pagination + search + filters (departments, simulations)
-- Standard groups and standards stay in SQL (rubric's own junction data)
-- 1) Drop function first (breaks dependency on types)
-- Drop all versions of the function using DO block to handle signature variations
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_get_rubrics_list_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_rubrics_list_v4(%s)', r.sig);
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
        WHERE typname LIKE 'q_get_rubrics_list_v4_%'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I', r.typname);
    END LOOP;
END $$;

-- 3) Recreate types
CREATE TYPE types.q_get_rubrics_list_v4_rubric AS (
    rubric_id uuid,
    name text,
    description text,
    points int,
    pass_points int,
    pass_percentage int,
    department_ids text[],
    simulation_ids text[],
    active_simulation_count int,
    standard_group_ids uuid[]
);

CREATE TYPE types.q_get_rubrics_list_v4_standard_group AS (
    standard_groups_id uuid,
    rubric_id uuid,
    name text,
    description text,
    points int,
    pass_points int
);

CREATE TYPE types.q_get_rubrics_list_v4_standard AS (
    standard_id uuid,
    standard_groups_id uuid,
    name text,
    description text,
    points int
);

-- Filter option type: value/label/count (names resolved in SQL, no Python hydration needed)
CREATE TYPE types.q_get_rubrics_list_v4_option AS (
    value text,
    label text,
    count bigint
);

-- 4) Recreate function
CREATE OR REPLACE FUNCTION api_get_rubrics_list_v4(
    profile_id uuid,
    search text DEFAULT NULL,
    filter_department_ids uuid[] DEFAULT NULL,
    filter_simulation_ids uuid[] DEFAULT NULL,
    department_search text DEFAULT NULL,
    simulation_search text DEFAULT NULL,
    page_size int DEFAULT 1000,
    page_offset int DEFAULT 0
)
RETURNS TABLE (
    rubrics types.q_get_rubrics_list_v4_rubric[],
    standard_groups types.q_get_rubrics_list_v4_standard_group[],
    standards types.q_get_rubrics_list_v4_standard[],
    department_options types.q_get_rubrics_list_v4_option[],
    simulation_options types.q_get_rubrics_list_v4_option[],
    total_count bigint
)
LANGUAGE sql
STABLE
AS $$
-- User context (actor_name, user_role) comes from get_profile_context_internal() in Python
WITH params AS (
    SELECT profile_id AS profile_id
),
user_departments AS (
    SELECT departments_id
    FROM params x
    JOIN profile_departments_junction ON profile_departments_junction.profile_id = x.profile_id AND profile_departments_junction.active = true
),
rubric_active_simulation_links AS (
    SELECT
        srr.rubric_id,
        COUNT(DISTINCT ss.simulation_id) as active_simulation_count
    FROM simulation_scenarios_junction ss
    JOIN simulation_scenario_rubrics_junction ssr ON ssr.simulation_id = ss.simulation_id
    JOIN scenario_rubrics_resource srr ON srr.id = ssr.scenario_rubrics_id AND srr.scenario_id = ss.scenarios_id
    JOIN simulation_artifact s ON s.id = ss.simulation_id
    WHERE EXISTS (SELECT 1 FROM simulation_scenario_flags_junction ssf JOIN scenario_flags_resource sfr ON ssf.scenario_flags_id = sfr.id JOIN flags_resource f ON sfr.flag_id = f.id WHERE ssf.simulation_id = ss.simulation_id AND sfr.scenario_id = ss.scenarios_id AND f.type = 'scenario_active' AND f.value = true) AND EXISTS (SELECT 1 FROM scenario_flags_junction sf JOIN flags_resource f ON sf.flags_id = f.id WHERE sf.scenario_id = s.id AND f.type = 'scenario_active' AND f.value = true) AND srr.rubric_id IS NOT NULL
    GROUP BY srr.rubric_id
),
simulation_department_access_for_rubrics AS (
    SELECT
        s.id as simulation_id,
        CASE
            WHEN COUNT(sd.simulation_id) FILTER (WHERE sd.departments_id IN (SELECT departments_id FROM user_departments)) > 0 THEN true
            WHEN NOT EXISTS (SELECT 1 FROM simulation_departments_junction sd2 WHERE sd2.simulation_id = s.id AND sd2.active = true
) THEN true
            ELSE false
        END as has_access
    FROM simulation_artifact s
    LEFT JOIN simulation_departments_junction sd ON sd.simulation_id = s.id AND sd.active = true
    WHERE EXISTS (SELECT 1 FROM scenario_flags_junction sf JOIN flags_resource f ON sf.flags_id = f.id WHERE sf.scenario_id = s.id AND f.type = 'scenario_active' AND f.value = true)
    GROUP BY s.id
),
rubric_simulations_distinct AS (
    SELECT DISTINCT ON (srr.rubric_id, s.id)
        srr.rubric_id,
        s.id as simulation_id
    FROM simulation_artifact s
    INNER JOIN simulation_department_access_for_rubrics sdar ON sdar.simulation_id = s.id AND sdar.has_access = true
    INNER JOIN simulation_scenarios_junction ss ON ss.simulation_id = s.id AND EXISTS (SELECT 1 FROM simulation_scenario_flags_junction ssf JOIN scenario_flags_resource sfr ON ssf.scenario_flags_id = sfr.id JOIN flags_resource f ON sfr.flag_id = f.id WHERE ssf.simulation_id = ss.simulation_id AND sfr.scenario_id = ss.scenarios_id AND f.type = 'scenario_active' AND f.value = true)
    INNER JOIN simulation_scenario_rubrics_junction ssr ON ssr.simulation_id = ss.simulation_id
    INNER JOIN scenario_rubrics_resource srr ON srr.id = ssr.scenario_rubrics_id AND srr.scenario_id = ss.scenarios_id
    WHERE EXISTS (SELECT 1 FROM scenario_flags_junction sf JOIN flags_resource f ON sf.flags_id = f.id WHERE sf.scenario_id = s.id AND f.type = 'scenario_active' AND f.value = true) AND srr.rubric_id IS NOT NULL
    ORDER BY srr.rubric_id, s.id
),
rubric_simulations_data AS (
    SELECT
        rsd.rubric_id,
        ARRAY_AGG(DISTINCT rsd.simulation_id::text ORDER BY rsd.simulation_id::text) as simulation_ids
    FROM rubric_simulations_distinct rsd
    GROUP BY rsd.rubric_id
),
rubric_departments_data AS (
    SELECT
        rd.rubric_id,
        ARRAY_AGG(rd.departments_id::text ORDER BY rd.created_at) as department_ids
    FROM rubric_departments_junction rd
    WHERE rd.active = true
    GROUP BY rd.rubric_id
),
rubric_data AS (
    SELECT
        r.id as rubric_id,
        (SELECT n.name FROM rubric_names_junction rn JOIN names_resource n ON rn.names_id = n.id WHERE rn.rubric_id = r.id LIMIT 1) as name,
        (SELECT d.description FROM rubric_descriptions_junction rd JOIN descriptions_resource d ON rd.descriptions_id = d.id WHERE rd.rubric_id = r.id LIMIT 1) as description,
        (SELECT p.value FROM rubric_points_junction rp JOIN points_resource p ON rp.points_id = p.id WHERE rp.rubric_id = r.id AND p.type = 'total'::point_type LIMIT 1) as points,
        (SELECT p.value FROM rubric_points_junction rp JOIN points_resource p ON rp.points_id = p.id WHERE rp.rubric_id = r.id AND p.type = 'pass'::point_type LIMIT 1) as pass_points,
        COALESCE(rdd.department_ids, NULL) as department_ids,
        COALESCE(rsd.simulation_ids, ARRAY[]::text[]) as simulation_ids,
        COALESCE(rasl.active_simulation_count, 0) as active_simulation_count
    FROM rubric_artifact r
    LEFT JOIN rubric_departments_junction rd ON rd.rubric_id = r.id AND rd.active = true
    LEFT JOIN rubric_departments_data rdd ON rdd.rubric_id = r.id
    LEFT JOIN rubric_simulations_data rsd ON rsd.rubric_id = r.id
    LEFT JOIN rubric_active_simulation_links rasl ON rasl.rubric_id = r.id
    GROUP BY r.id, (SELECT n.name FROM rubric_names_junction rn JOIN names_resource n ON rn.names_id = n.id WHERE rn.rubric_id = r.id LIMIT 1), (SELECT d.description FROM rubric_descriptions_junction rd JOIN descriptions_resource d ON rd.descriptions_id = d.id WHERE rd.rubric_id = r.id LIMIT 1), (SELECT p.value FROM rubric_points_junction rp JOIN points_resource p ON rp.points_id = p.id WHERE rp.rubric_id = r.id AND p.type = 'total'::point_type LIMIT 1), (SELECT p.value FROM rubric_points_junction rp JOIN points_resource p ON rp.points_id = p.id WHERE rp.rubric_id = r.id AND p.type = 'pass'::point_type LIMIT 1), rdd.department_ids, rsd.simulation_ids, rasl.active_simulation_count
    HAVING
        COUNT(rd.rubric_id) FILTER (WHERE rd.departments_id IN (SELECT departments_id FROM user_departments)) > 0
        OR NOT EXISTS (SELECT 1 FROM rubric_departments_junction rd2 WHERE rd2.rubric_id = r.id AND rd2.active = true)
),
-- Apply server-side filters
filtered_rubrics AS (
    SELECT rd.*
    FROM rubric_data rd
    WHERE
        -- Search filter: match name or description (case-insensitive)
        (search IS NULL OR LOWER(rd.name) LIKE '%' || LOWER(search) || '%' OR LOWER(rd.description) LIKE '%' || LOWER(search) || '%')
        -- Department filter: rubric must belong to at least one selected department
        AND (filter_department_ids IS NULL OR rd.department_ids && filter_department_ids::text[])
        -- Simulation filter: rubric must be linked to at least one selected simulation
        AND (filter_simulation_ids IS NULL OR rd.simulation_ids && filter_simulation_ids::text[])
),
-- Count total filtered results (before pagination)
filtered_count AS (
    SELECT COUNT(*)::bigint as total_count FROM filtered_rubrics
),
-- Paginate filtered results
paginated_rubrics AS (
    SELECT fr.*
    FROM filtered_rubrics fr
    ORDER BY fr.name
    LIMIT page_size OFFSET page_offset
),
-- Standard groups and standards scoped to paginated rubrics
all_rubric_ids AS (
    SELECT DISTINCT rubric_id FROM paginated_rubrics
),
rubric_standard_group_ids AS (
    SELECT
        rsg.rubric_id,
        ARRAY_AGG(rsg.standard_groups_id ORDER BY sg.name) as standard_group_ids
    FROM rubric_standard_groups_junction rsg
    JOIN standard_groups_resource sg ON sg.id = rsg.standard_groups_id
    WHERE rsg.rubric_id IN (SELECT rubric_id FROM all_rubric_ids) AND rsg.active = true
    GROUP BY rsg.rubric_id
),
all_standard_group_ids AS (
    SELECT DISTINCT rsg.standard_groups_id
    FROM rubric_standard_groups_junction rsg
    WHERE rsg.rubric_id IN (SELECT rubric_id FROM all_rubric_ids) AND rsg.active = true
),
standard_groups_distinct AS (
    SELECT DISTINCT ON (sg.id)
        sg.id, rsg.rubric_id, sg.name, COALESCE(sg.description, '') as description, sg.points, sg.pass_points
    FROM rubric_standard_groups_junction rsg
    JOIN standard_groups_resource sg ON sg.id = rsg.standard_groups_id
    WHERE rsg.rubric_id IN (SELECT rubric_id FROM all_rubric_ids) AND rsg.active = true
    ORDER BY sg.id, rsg.rubric_id, sg.name
),
standard_groups_aggregated AS (
    SELECT
        COALESCE(
            ARRAY_AGG(
                (sgd.id, sgd.rubric_id, sgd.name, sgd.description, sgd.points, sgd.pass_points)::types.q_get_rubrics_list_v4_standard_group
                ORDER BY sgd.rubric_id, sgd.name
            ),
            '{}'::types.q_get_rubrics_list_v4_standard_group[]
        ) as standard_groups
    FROM standard_groups_distinct sgd
),
standards_distinct AS (
    SELECT DISTINCT ON (s.id)
        s.id, s.standard_groups_id, (SELECT n.name FROM scenario_names_junction sn JOIN names_resource n ON sn.names_id = n.id WHERE sn.scenario_id = s.id LIMIT 1), COALESCE((SELECT (SELECT d.description FROM document_descriptions_junction dd JOIN descriptions_resource d ON dd.descriptions_id = d.id WHERE dd.document_id = d.id LIMIT 1) FROM scenario_descriptions_junction sd JOIN descriptions_resource d ON sd.descriptions_id = d.id WHERE sd.scenario_id = s.id LIMIT 1), '') as description, s.points
    FROM standards_resource s
    WHERE s.standard_groups_id IN (SELECT standard_groups_id FROM all_standard_group_ids)
    ORDER BY s.id, s.standard_groups_id, (SELECT n.name FROM scenario_names_junction sn JOIN names_resource n ON sn.names_id = n.id WHERE sn.scenario_id = s.id LIMIT 1)
),
standards_aggregated AS (
    SELECT
        COALESCE(
            ARRAY_AGG(
                (sd.id, sd.standard_groups_id, sd.name, sd.description, sd.points)::types.q_get_rubrics_list_v4_standard
                ORDER BY sd.standard_groups_id, sd.name
            ),
            '{}'::types.q_get_rubrics_list_v4_standard[]
        ) as standards
    FROM standards_distinct sd
),
-- Department options with names resolved in SQL (ListFilterSection pattern)
department_option_data AS (
    SELECT
        dr.id::text as value,
        (SELECT n.name FROM department_names_junction dn JOIN names_resource n ON n.id = dn.names_id WHERE dn.department_id = dd.department_id LIMIT 1) as label,
        (SELECT COUNT(*) FROM rubric_data rd WHERE rd.department_ids IS NOT NULL AND dr.id::text = ANY(rd.department_ids)) as count
    FROM departments_resource dr
    JOIN department_departments_junction dd ON dd.department_id = dr.id
    WHERE dr.id IN (SELECT departments_id FROM user_departments)
      AND (department_search IS NULL OR LOWER((SELECT n.name FROM department_names_junction dn JOIN names_resource n ON n.id = dn.names_id WHERE dn.department_id = dd.department_id LIMIT 1)) LIKE '%' || LOWER(department_search) || '%')
),
-- Simulation options with names resolved in SQL
simulation_option_data AS (
    SELECT
        rsd.simulation_id::text as value,
        (SELECT n.name FROM simulation_names_junction sn JOIN names_resource n ON n.id = sn.names_id WHERE sn.simulation_id = rsd.simulation_id LIMIT 1) as label,
        COUNT(DISTINCT rsd.rubric_id) as count
    FROM rubric_simulations_distinct rsd
    WHERE rsd.rubric_id IN (SELECT rubric_id FROM rubric_data)
      AND (simulation_search IS NULL OR LOWER((SELECT n.name FROM simulation_names_junction sn JOIN names_resource n ON n.id = sn.names_id WHERE sn.simulation_id = rsd.simulation_id LIMIT 1)) LIKE '%' || LOWER(simulation_search) || '%')
    GROUP BY rsd.simulation_id
)
SELECT
    -- Aggregate paginated rubrics
    COALESCE(
        (SELECT ARRAY_AGG(
            (pr.rubric_id,
             pr.name,
             pr.description,
             pr.points,
             pr.pass_points,
             CASE WHEN pr.points > 0 THEN ROUND((pr.pass_points::numeric / pr.points::numeric) * 100) ELSE 0 END::int,
             pr.department_ids,
             pr.simulation_ids,
             pr.active_simulation_count,
             COALESCE(rsgi.standard_group_ids, ARRAY[]::uuid[])
            )::types.q_get_rubrics_list_v4_rubric
            ORDER BY pr.name
        ) FROM paginated_rubrics pr
        LEFT JOIN rubric_standard_group_ids rsgi ON rsgi.rubric_id = pr.rubric_id),
        '{}'::types.q_get_rubrics_list_v4_rubric[]
    ) as rubrics,
    -- Standard groups for paginated rubrics
    (SELECT standard_groups FROM standard_groups_aggregated) as standard_groups,
    -- Standards for paginated rubrics
    (SELECT standards FROM standards_aggregated) as standards,
    -- Department options (names resolved in SQL)
    COALESCE(
        (SELECT ARRAY_AGG(
            (dod.value, dod.label, dod.count)::types.q_get_rubrics_list_v4_option
            ORDER BY dod.label
        ) FROM department_option_data dod),
        '{}'::types.q_get_rubrics_list_v4_option[]
    ) as department_options,
    -- Simulation options (names resolved in SQL)
    COALESCE(
        (SELECT ARRAY_AGG(
            (sod.value, sod.label, sod.count)::types.q_get_rubrics_list_v4_option
            ORDER BY sod.label
        ) FROM simulation_option_data sod),
        '{}'::types.q_get_rubrics_list_v4_option[]
    ) as simulation_options,
    -- Total count of filtered rubrics (before pagination)
    (SELECT total_count FROM filtered_count) as total_count
FROM params
$$;
