-- Get rubrics list with permissions
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
        WHERE proname = 'api_get_rubrics_list_v3'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_rubrics_list_v3(%s)', r.sig);
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
        WHERE typname LIKE 'q_get_rubrics_list_v3_%'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I', r.typname);
    END LOOP;
END $$;

-- 3) Recreate types
CREATE TYPE types.q_get_rubrics_list_v3_rubric AS (
    rubric_id uuid,
    name text,
    description text,
    points int,
    pass_points int,
    pass_percentage int,
    agent_role text,
    department_ids text[],
    simulation_ids text[],
    active_simulation_count int,
    total_simulation_links int,
    can_edit boolean,
    can_delete boolean,
    can_duplicate boolean,
    standard_group_ids uuid[]
);

CREATE TYPE types.q_get_rubrics_list_v3_standard_group AS (
    standard_group_id uuid,
    rubric_id uuid,
    name text,
    description text,
    points int,
    pass_points int
);

CREATE TYPE types.q_get_rubrics_list_v3_standard AS (
    standard_id uuid,
    standard_group_id uuid,
    name text,
    description text,
    points int
);

CREATE TYPE types.q_get_rubrics_list_v3_department AS (
    department_id uuid,
    name text,
    description text
);

CREATE TYPE types.q_get_rubrics_list_v3_simulation AS (
    simulation_id uuid,
    name text,
    description text,
    time_limit int
);

-- 4) Recreate function
CREATE OR REPLACE FUNCTION api_get_rubrics_list_v3(profile_id uuid)
RETURNS TABLE (
    actor_name text,
    rubrics types.q_get_rubrics_list_v3_rubric[],
    standard_groups types.q_get_rubrics_list_v3_standard_group[],
    standards types.q_get_rubrics_list_v3_standard[],
    departments types.q_get_rubrics_list_v3_department[],
    simulations types.q_get_rubrics_list_v3_simulation[],
    simulation_options types.q_get_rubrics_list_v3_simulation[]
)
LANGUAGE sql
STABLE
AS $$
WITH params AS (
    SELECT profile_id AS profile_id
),
user_departments AS (
    SELECT department_id
    FROM params x
    JOIN profile_departments ON profile_departments.profile_id = x.profile_id AND profile_departments.active = true
),
rubric_active_simulation_links AS (
    SELECT 
        rga.rubric_id,
        COUNT(DISTINCT ss.simulation_id) as active_simulation_count
    FROM simulation_scenarios ss
    JOIN simulation_scenarios_rubric_grade_agents ssrga ON ssrga.simulation_id = ss.simulation_id AND ssrga.scenario_id = ss.scenario_id
    JOIN rubric_grade_agents rga ON rga.id = ssrga.rubric_grade_agent_id
    JOIN simulations s ON s.id = ss.simulation_id
    WHERE ss.active = true AND s.active = true AND rga.rubric_id IS NOT NULL
    GROUP BY rga.rubric_id
),
rubric_all_simulation_links AS (
    SELECT 
        rga.rubric_id,
        COUNT(DISTINCT ss.simulation_id) as total_simulation_links
    FROM simulation_scenarios ss
    JOIN simulation_scenarios_rubric_grade_agents ssrga ON ssrga.simulation_id = ss.simulation_id AND ssrga.scenario_id = ss.scenario_id
    JOIN rubric_grade_agents rga ON rga.id = ssrga.rubric_grade_agent_id
    WHERE rga.rubric_id IS NOT NULL
    GROUP BY rga.rubric_id
),
simulation_department_access_for_rubrics AS (
    -- Pre-compute which simulations the user has access to (for filtering rubric_simulations_data)
    SELECT 
        s.id as simulation_id,
        CASE 
            -- Include if has matching department link OR has no department links at all (cross-dept)
            WHEN COUNT(sd.simulation_id) FILTER (WHERE sd.department_id IN (SELECT department_id FROM user_departments)) > 0 THEN true
            WHEN NOT EXISTS (SELECT 1 FROM simulation_departments sd2 WHERE sd2.simulation_id = s.id AND sd2.active = true) THEN true
            ELSE false
        END as has_access
    FROM simulations s
    LEFT JOIN simulation_departments sd ON sd.simulation_id = s.id AND sd.active = true
    WHERE s.active = true
    GROUP BY s.id
),
rubric_simulations_distinct AS (
    SELECT DISTINCT ON (rga.rubric_id, s.id)
        rga.rubric_id,
        s.id as simulation_id,
        s.title as simulation_title
    FROM simulations s
    INNER JOIN simulation_department_access_for_rubrics sdar ON sdar.simulation_id = s.id AND sdar.has_access = true
    INNER JOIN simulation_scenarios ss ON ss.simulation_id = s.id AND ss.active = true
    INNER JOIN simulation_scenarios_rubric_grade_agents ssrga ON ssrga.simulation_id = ss.simulation_id AND ssrga.scenario_id = ss.scenario_id
    INNER JOIN rubric_grade_agents rga ON rga.id = ssrga.rubric_grade_agent_id
    WHERE s.active = true AND rga.rubric_id IS NOT NULL
    ORDER BY rga.rubric_id, s.id, s.title
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
        ARRAY_AGG(rd.department_id::text ORDER BY rd.created_at) as department_ids
    FROM rubric_departments rd
    WHERE rd.active = true
    GROUP BY rd.rubric_id
),
user_profile AS (
    SELECT 
        role,
        COALESCE(p.first_name || ' ' || p.last_name, 'System') as actor_name
    FROM params x
    JOIN profiles p ON p.id = x.profile_id
),
rubric_data AS (
    SELECT 
        r.id as rubric_id,
        r.name,
        r.description,
        r.points,
        r.pass_points as pass_points,
        r.agent_role::text as agent_role,
        COALESCE(rdd.department_ids, NULL) as department_ids,
        COALESCE(rsd.simulation_ids, ARRAY[]::text[]) as simulation_ids,
        COALESCE(rasl.active_simulation_count, 0) as active_simulation_count,
        COALESCE(rasl_all.total_simulation_links, 0) as total_simulation_links,
        CASE 
            WHEN COALESCE(rasl.active_simulation_count, 0) > 0 THEN false
            WHEN up.role IN (profile_role.admin, profile_role.superadmin) THEN true
            ELSE false
        END as can_edit,
        CASE 
            WHEN COALESCE(rasl_all.total_simulation_links, 0) > 0 THEN false
            WHEN up.role IN (profile_role.admin, profile_role.superadmin) THEN true
            ELSE false
        END as can_delete,
        CASE 
            WHEN up.role IN (profile_role.admin, profile_role.superadmin) THEN true
            ELSE false
        END as can_duplicate
    FROM rubrics r
    LEFT JOIN rubric_departments rd ON rd.rubric_id = r.id AND rd.active = true
    LEFT JOIN rubric_departments_data rdd ON rdd.rubric_id = r.id
    LEFT JOIN rubric_simulations_data rsd ON rsd.rubric_id = r.id
    LEFT JOIN rubric_active_simulation_links rasl ON rasl.rubric_id = r.id
    LEFT JOIN rubric_all_simulation_links rasl_all ON rasl_all.rubric_id = r.id
    CROSS JOIN user_profile up
    GROUP BY r.id, r.name, r.description, r.points, r.pass_points, r.agent_role, rdd.department_ids, rsd.simulation_ids, rasl.active_simulation_count, rasl_all.total_simulation_links, up.role
    HAVING 
        COUNT(rd.rubric_id) FILTER (WHERE rd.department_id IN (SELECT department_id FROM user_departments)) > 0
        OR NOT EXISTS (SELECT 1 FROM rubric_departments rd2 WHERE rd2.rubric_id = r.id AND rd2.active = true)
),
all_rubric_ids AS (
    SELECT DISTINCT rubric_id FROM rubric_data
),
rubric_standard_group_ids AS (
    SELECT 
        rsg.rubric_id,
        ARRAY_AGG(rsg.standard_group_id ORDER BY rsg.position, sg.name) as standard_group_ids
    FROM rubric_standard_groups rsg
    JOIN standard_groups sg ON sg.id = rsg.standard_group_id
    WHERE rsg.rubric_id IN (SELECT rubric_id FROM all_rubric_ids) AND rsg.active = true
    GROUP BY rsg.rubric_id
),
all_standard_group_ids AS (
    SELECT DISTINCT rsg.standard_group_id
    FROM rubric_standard_groups rsg
    WHERE rsg.rubric_id IN (SELECT rubric_id FROM all_rubric_ids) AND rsg.active = true
),
all_standard_ids AS (
    SELECT DISTINCT s.id as standard_id
    FROM standards s
    WHERE s.standard_group_id IN (SELECT standard_group_id FROM all_standard_group_ids)
),
all_department_ids AS (
    SELECT DISTINCT unnest(department_ids)::uuid as department_id
    FROM rubric_departments_data
    WHERE department_ids IS NOT NULL
),
all_simulation_ids AS (
    SELECT DISTINCT unnest(simulation_ids)::uuid as simulation_id
    FROM rubric_simulations_data
    WHERE simulation_ids IS NOT NULL
),
-- Collect all assigned simulation IDs and department IDs from rubric_data for filtering
assigned_simulation_ids AS (
    SELECT DISTINCT unnest(simulation_ids)::uuid as simulation_id
    FROM rubric_data
    WHERE simulation_ids IS NOT NULL AND COALESCE(array_length(simulation_ids, 1), 0) > 0
),
assigned_department_ids AS (
    SELECT DISTINCT unnest(department_ids)::uuid as department_id
    FROM rubric_data
    WHERE department_ids IS NOT NULL AND COALESCE(array_length(department_ids, 1), 0) > 0
),
standard_groups_distinct AS (
    SELECT DISTINCT ON (sg.id)
        sg.id, rsg.rubric_id, sg.name, COALESCE(sg.description, '') as description, sg.points, sg.pass_points, rsg.position
    FROM rubric_standard_groups rsg
    JOIN standard_groups sg ON sg.id = rsg.standard_group_id
    WHERE rsg.rubric_id IN (SELECT rubric_id FROM all_rubric_ids) AND rsg.active = true
    ORDER BY sg.id, rsg.rubric_id, rsg.position, sg.name
),
standard_groups_aggregated AS (
    SELECT 
        COALESCE(
            ARRAY_AGG(
                (sgd.id, sgd.rubric_id, sgd.name, sgd.description, sgd.points, sgd.pass_points)::types.q_get_rubrics_list_v3_standard_group
                ORDER BY sgd.rubric_id, sgd.position, sgd.name
            ),
            '{}'::types.q_get_rubrics_list_v3_standard_group[]
        ) as standard_groups
    FROM standard_groups_distinct sgd
),
standards_distinct AS (
    SELECT DISTINCT ON (s.id)
        s.id, s.standard_group_id, s.name, COALESCE(s.description, '') as description, s.points
    FROM standards s
    WHERE s.standard_group_id IN (SELECT standard_group_id FROM all_standard_group_ids)
    ORDER BY s.id, s.standard_group_id, s.name
),
standards_aggregated AS (
    SELECT 
        COALESCE(
            ARRAY_AGG(
                (sd.id, sd.standard_group_id, sd.name, sd.description, sd.points)::types.q_get_rubrics_list_v3_standard
                ORDER BY sd.standard_group_id, sd.name
            ),
            '{}'::types.q_get_rubrics_list_v3_standard[]
        ) as standards
    FROM standards_distinct sd
),
departments_distinct AS (
    SELECT DISTINCT ON (d.id)
        d.id, d.title, COALESCE(d.description, '') as description
    FROM departments d
    WHERE d.id IN (SELECT department_id FROM assigned_department_ids)
    ORDER BY d.id, d.title
),
departments_aggregated AS (
    SELECT 
        COALESCE(
            ARRAY_AGG(
                (dd.id, dd.title, dd.description)::types.q_get_rubrics_list_v3_department
                ORDER BY dd.title
            ),
            '{}'::types.q_get_rubrics_list_v3_department[]
        ) as departments
    FROM departments_distinct dd
),
simulations_with_time_limit AS (
    SELECT DISTINCT ON (s.id)
        s.id, 
        s.title, 
        COALESCE(s.description, '') as description,
        COALESCE(
            (SELECT SUM(stl.time_limit_seconds)
             FROM scenario_time_limits stl
             JOIN simulation_scenarios ss ON ss.simulation_id = stl.simulation_id AND ss.scenario_id = stl.scenario_id
             WHERE stl.simulation_id = s.id AND stl.active = true AND ss.active = true),
            0
        )::int as time_limit
    FROM simulations s
    INNER JOIN simulation_department_access_for_rubrics sdar ON sdar.simulation_id = s.id AND sdar.has_access = true
    WHERE s.active = true 
      AND s.id IN (SELECT simulation_id FROM all_simulation_ids)
    ORDER BY s.id, s.title
),
simulations_aggregated AS (
    SELECT 
        COALESCE(
            ARRAY_AGG(
                (swtl.id, swtl.title, swtl.description, swtl.time_limit)::types.q_get_rubrics_list_v3_simulation
                ORDER BY swtl.title
            ),
            '{}'::types.q_get_rubrics_list_v3_simulation[]
        ) as simulations
    FROM simulations_with_time_limit swtl
),
-- Filter simulation_options to only include assigned simulations (with disambiguation for duplicate names)
simulation_name_counts AS (
    SELECT s.title, COUNT(*) as count
    FROM simulations s
    WHERE s.id IN (SELECT simulation_id FROM assigned_simulation_ids)
    GROUP BY s.title
),
simulation_options_with_disambiguation AS (
    SELECT DISTINCT ON (s.id)
        s.id,
        CASE 
            WHEN snc.count > 1 THEN s.title || ' (' || RIGHT(s.id::text, 8) || ')'
            ELSE s.title
        END as name,
        COALESCE(s.description, '') as description,
        COALESCE(
            (SELECT SUM(stl.time_limit_seconds)
             FROM scenario_time_limits stl
             JOIN simulation_scenarios ss ON ss.simulation_id = stl.simulation_id AND ss.scenario_id = stl.scenario_id
             WHERE stl.simulation_id = s.id AND stl.active = true AND ss.active = true),
            0
        )::int as time_limit
    FROM simulations s
    INNER JOIN simulation_department_access_for_rubrics sdar ON sdar.simulation_id = s.id AND sdar.has_access = true
    LEFT JOIN simulation_name_counts snc ON snc.title = s.title
    WHERE s.active = true 
      AND s.id IN (SELECT simulation_id FROM assigned_simulation_ids)
    ORDER BY s.id, s.title
),
simulation_options_aggregated AS (
    SELECT 
        COALESCE(
            ARRAY_AGG(
                (sod.id, sod.name, sod.description, sod.time_limit)::types.q_get_rubrics_list_v3_simulation
                ORDER BY sod.name
            ),
            '{}'::types.q_get_rubrics_list_v3_simulation[]
        ) as simulation_options
    FROM simulation_options_with_disambiguation sod
)
SELECT 
    up.actor_name::text as actor_name,
    COALESCE(
        ARRAY_AGG(
            (rd.rubric_id,
             rd.name,
             rd.description,
             rd.points,
             rd.pass_points,
             CASE WHEN rd.points > 0 THEN ROUND((rd.pass_points::numeric / rd.points::numeric) * 100) ELSE 0 END::int,
             rd.agent_role,
             rd.department_ids,
             rd.simulation_ids,
             rd.active_simulation_count,
             rd.total_simulation_links,
             rd.can_edit,
             rd.can_delete,
             rd.can_duplicate,
             COALESCE(rsgi.standard_group_ids, ARRAY[]::uuid[])
            )::types.q_get_rubrics_list_v3_rubric
            ORDER BY rd.name
        ),
        '{}'::types.q_get_rubrics_list_v3_rubric[]
    ) as rubrics,
    sga.standard_groups,
    sta.standards,
    da.departments,
    sima.simulations,
    soa.simulation_options
FROM rubric_data rd
CROSS JOIN user_profile up
LEFT JOIN rubric_standard_group_ids rsgi ON rsgi.rubric_id = rd.rubric_id
CROSS JOIN standard_groups_aggregated sga
CROSS JOIN standards_aggregated sta
CROSS JOIN departments_aggregated da
CROSS JOIN simulations_aggregated sima
CROSS JOIN simulation_options_aggregated soa
GROUP BY up.actor_name, sga.standard_groups, sta.standards, da.departments, sima.simulations, soa.simulation_options
$$;

COMMIT;

