-- Get rubrics list with permissions
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
    total_simulation_links int,
    can_edit boolean,
    can_delete boolean,
    can_duplicate boolean,
    standard_group_ids uuid[]
);

CREATE TYPE types.q_get_rubrics_list_v4_standard_group AS (
    standard_group_id uuid,
    rubric_id uuid,
    name text,
    description text,
    points int,
    pass_points int
);

CREATE TYPE types.q_get_rubrics_list_v4_standard AS (
    standard_id uuid,
    standard_group_id uuid,
    name text,
    description text,
    points int
);

CREATE TYPE types.q_get_rubrics_list_v4_department AS (
    department_id uuid,
    name text,
    description text
);

CREATE TYPE types.q_get_rubrics_list_v4_simulation AS (
    simulation_id uuid,
    name text,
    description text,
    time_limit int
);

-- 4) Recreate function
CREATE OR REPLACE FUNCTION api_get_rubrics_list_v4(profile_id uuid)
RETURNS TABLE (
    actor_name text,
    rubrics types.q_get_rubrics_list_v4_rubric[],
    standard_groups types.q_get_rubrics_list_v4_standard_group[],
    standards types.q_get_rubrics_list_v4_standard[],
    departments types.q_get_rubrics_list_v4_department[],
    simulations types.q_get_rubrics_list_v4_simulation[],
    simulation_options types.q_get_rubrics_list_v4_simulation[]
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
    JOIN profile_departments_junction ON profile_departments_junction.profile_id = x.profile_id AND profile_departments_junction.active = true
),
rubric_active_simulation_links AS (
    SELECT 
        srr.rubric_id,
        COUNT(DISTINCT ss.simulation_id) as active_simulation_count
    FROM simulation_scenarios_junction ss
    JOIN simulation_scenario_rubrics_junction ssr ON ssr.simulation_id = ss.simulation_id
    JOIN scenario_rubrics_resource srr ON srr.id = ssr.scenario_rubric_id AND srr.scenario_id = ss.scenario_id
    JOIN simulation_artifact s ON s.id = ss.simulation_id
    WHERE EXISTS (SELECT 1 FROM simulation_scenario_flags_junction ssf JOIN scenario_flags_resource sfr ON ssf.scenario_flag_id = sfr.id JOIN flags_resource f ON sfr.flag_id = f.id WHERE ssf.simulation_id = ss.simulation_id AND sfr.scenario_id = ss.scenario_id AND f.name = 'scenario_active' AND ssf.value = true) AND EXISTS (SELECT 1 FROM scenario_flags_junction sf JOIN flags_resource f ON sf.flag_id = f.id WHERE sf.scenario_id = s.id AND f.name = 'scenario_active' AND sf.value = true) AND srr.rubric_id IS NOT NULL
    GROUP BY srr.rubric_id
),
rubric_all_simulation_links AS (
    SELECT 
        srr.rubric_id,
        COUNT(DISTINCT ss.simulation_id) as total_simulation_links
    FROM simulation_scenarios_junction ss
    JOIN simulation_scenario_rubrics_junction ssr ON ssr.simulation_id = ss.simulation_id
    JOIN scenario_rubrics_resource srr ON srr.id = ssr.scenario_rubric_id AND srr.scenario_id = ss.scenario_id
    WHERE srr.rubric_id IS NOT NULL
    GROUP BY srr.rubric_id
),
simulation_department_access_for_rubrics AS (
    -- Pre-compute which simulations the user has access to (for filtering rubric_simulations_data)
    SELECT 
        s.id as simulation_id,
        CASE 
            -- Include if has matching department link OR has no department links at all (cross-dept)
            WHEN COUNT(sd.simulation_id) FILTER (WHERE sd.department_id IN (SELECT department_id FROM user_departments)) > 0 THEN true
            WHEN NOT EXISTS (SELECT 1 FROM simulation_departments_junction sd2 WHERE sd2.simulation_id = s.id AND sd2.active = true) THEN true
            ELSE false
        END as has_access
    FROM simulation_artifact s
    LEFT JOIN simulation_departments_junction sd ON sd.simulation_id = s.id AND sd.active = true
    WHERE EXISTS (SELECT 1 FROM scenario_flags_junction sf JOIN flags_resource f ON sf.flag_id = f.id WHERE sf.scenario_id = s.id AND f.name = 'scenario_active' AND sf.value = true)
    GROUP BY s.id
),
rubric_simulations_distinct AS (
    SELECT DISTINCT ON (srr.rubric_id, s.id)
        srr.rubric_id,
        s.id as simulation_id,
        (SELECT n.name FROM simulation_names_junction sn JOIN names_resource n ON sn.name_id = n.id WHERE sn.simulation_id = s.id LIMIT 1) as simulation_title
    FROM simulation_artifact s
    INNER JOIN simulation_department_access_for_rubrics sdar ON sdar.simulation_id = s.id AND sdar.has_access = true
    INNER JOIN simulation_scenarios_junction ss ON ss.simulation_id = s.id AND EXISTS (SELECT 1 FROM simulation_scenario_flags_junction ssf JOIN scenario_flags_resource sfr ON ssf.scenario_flag_id = sfr.id JOIN flags_resource f ON sfr.flag_id = f.id WHERE ssf.simulation_id = ss.simulation_id AND sfr.scenario_id = ss.scenario_id AND f.name = 'scenario_active' AND ssf.value = true)
    INNER JOIN simulation_scenario_rubrics_junction ssr ON ssr.simulation_id = ss.simulation_id
    INNER JOIN scenario_rubrics_resource srr ON srr.id = ssr.scenario_rubric_id AND srr.scenario_id = ss.scenario_id
    WHERE EXISTS (SELECT 1 FROM scenario_flags_junction sf JOIN flags_resource f ON sf.flag_id = f.id WHERE sf.scenario_id = s.id AND f.name = 'scenario_active' AND sf.value = true) AND srr.rubric_id IS NOT NULL
    ORDER BY srr.rubric_id, s.id, (SELECT n.name FROM simulation_names_junction sn JOIN names_resource n ON sn.name_id = n.id WHERE sn.simulation_id = s.id LIMIT 1)
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
    FROM rubric_departments_junction rd
    WHERE rd.active = true
    GROUP BY rd.rubric_id
),
user_profile AS (
    SELECT role, COALESCE(NULLIF(actor_name, ''), 'System') as actor_name
    FROM view_user_profile_context
    WHERE profile_id = (SELECT profile_id FROM params)
),
rubric_data AS (
    SELECT 
        r.id as rubric_id,
        (SELECT n.name FROM rubric_names_junction rn JOIN names_resource n ON rn.name_id = n.id WHERE rn.rubric_id = r.id LIMIT 1),
        (SELECT d.description FROM rubric_descriptions_junction rd JOIN descriptions_resource d ON rd.description_id = d.id WHERE rd.rubric_id = r.id LIMIT 1),
        (SELECT p.value FROM rubric_points_junction rp JOIN points_resource p ON rp.point_id = p.id WHERE rp.rubric_id = r.id AND rp.type = 'total'::point_type LIMIT 1) as points,
        (SELECT p.value FROM rubric_points_junction rp JOIN points_resource p ON rp.point_id = p.id WHERE rp.rubric_id = r.id AND rp.type = 'pass'::point_type LIMIT 1) as pass_points,
        COALESCE(rdd.department_ids, NULL) as department_ids,
        COALESCE(rsd.simulation_ids, ARRAY[]::text[]) as simulation_ids,
        COALESCE(rasl.active_simulation_count, 0) as active_simulation_count,
        COALESCE(rasl_all.total_simulation_links, 0) as total_simulation_links,
        CASE 
            WHEN COALESCE(rasl.active_simulation_count, 0) > 0 THEN false
            WHEN up.role IN ('admin'::profile_type, 'superadmin'::profile_type) THEN true
            ELSE false
        END as can_edit,
        CASE 
            WHEN COALESCE(rasl_all.total_simulation_links, 0) > 0 THEN false
            WHEN up.role IN ('admin'::profile_type, 'superadmin'::profile_type) THEN true
            ELSE false
        END as can_delete,
        CASE 
            WHEN up.role IN ('admin'::profile_type, 'superadmin'::profile_type) THEN true
            ELSE false
        END as can_duplicate
    FROM rubric_artifact r
    LEFT JOIN rubric_departments_junction rd ON rd.rubric_id = r.id AND rd.active = true
    LEFT JOIN rubric_departments_data rdd ON rdd.rubric_id = r.id
    LEFT JOIN rubric_simulations_data rsd ON rsd.rubric_id = r.id
    LEFT JOIN rubric_active_simulation_links rasl ON rasl.rubric_id = r.id
    LEFT JOIN rubric_all_simulation_links rasl_all ON rasl_all.rubric_id = r.id
    CROSS JOIN user_profile up
    GROUP BY r.id, (SELECT n.name FROM rubric_names_junction rn JOIN names_resource n ON rn.name_id = n.id WHERE rn.rubric_id = r.id LIMIT 1), (SELECT d.description FROM rubric_descriptions_junction rd JOIN descriptions_resource d ON rd.description_id = d.id WHERE rd.rubric_id = r.id LIMIT 1), (SELECT p.value FROM rubric_points_junction rp JOIN points_resource p ON rp.point_id = p.id WHERE rp.rubric_id = r.id AND rp.type = 'total'::point_type LIMIT 1), (SELECT p.value FROM rubric_points_junction rp JOIN points_resource p ON rp.point_id = p.id WHERE rp.rubric_id = r.id AND rp.type = 'pass'::point_type LIMIT 1), rdd.department_ids, rsd.simulation_ids, rasl.active_simulation_count, rasl_all.total_simulation_links, up.role
    HAVING 
        COUNT(rd.rubric_id) FILTER (WHERE rd.department_id IN (SELECT department_id FROM user_departments)) > 0
        OR NOT EXISTS (SELECT 1 FROM rubric_departments_junction rd2 WHERE rd2.rubric_id = r.id AND rd2.active = true)
),
all_rubric_ids AS (
    SELECT DISTINCT rubric_id FROM rubric_data
),
rubric_standard_group_ids AS (
    SELECT 
        rsg.rubric_id,
        ARRAY_AGG(rsg.standard_group_id ORDER BY rsg.position, sg.name) as standard_group_ids
    FROM rubric_standard_groups_junction rsg
    JOIN standard_groups_resource sg ON sg.id = rsg.standard_group_id
    WHERE rsg.rubric_id IN (SELECT rubric_id FROM all_rubric_ids) AND rsg.active = true
    GROUP BY rsg.rubric_id
),
all_standard_group_ids AS (
    SELECT DISTINCT rsg.standard_group_id
    FROM rubric_standard_groups_junction rsg
    WHERE rsg.rubric_id IN (SELECT rubric_id FROM all_rubric_ids) AND rsg.active = true
),
all_standard_ids AS (
    SELECT DISTINCT s.id as standard_id
    FROM standards_resource s
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
    FROM rubric_standard_groups_junction rsg
    JOIN standard_groups_resource sg ON sg.id = rsg.standard_group_id
    WHERE rsg.rubric_id IN (SELECT rubric_id FROM all_rubric_ids) AND rsg.active = true
    ORDER BY sg.id, rsg.rubric_id, rsg.position, sg.name
),
standard_groups_aggregated AS (
    SELECT 
        COALESCE(
            ARRAY_AGG(
                (sgd.id, sgd.rubric_id, sgd.name, sgd.description, sgd.points, sgd.pass_points)::types.q_get_rubrics_list_v4_standard_group
                ORDER BY sgd.rubric_id, sgd.position, sgd.name
            ),
            '{}'::types.q_get_rubrics_list_v4_standard_group[]
        ) as standard_groups
    FROM standard_groups_distinct sgd
),
standards_distinct AS (
    SELECT DISTINCT ON (s.id)
        s.id, s.standard_group_id, (SELECT n.name FROM scenario_names_junction sn JOIN names_resource n ON sn.name_id = n.id WHERE sn.scenario_id = s.id LIMIT 1), COALESCE((SELECT (SELECT d.description FROM document_descriptions_junction dd JOIN descriptions_resource d ON dd.description_id = d.id WHERE dd.document_id = d.id LIMIT 1) FROM scenario_descriptions_junction sd JOIN descriptions_resource d ON sd.description_id = d.id WHERE sd.scenario_id = s.id LIMIT 1), '') as description, s.points
    FROM standards_resource s
    WHERE s.standard_group_id IN (SELECT standard_group_id FROM all_standard_group_ids)
    ORDER BY s.id, s.standard_group_id, (SELECT n.name FROM scenario_names_junction sn JOIN names_resource n ON sn.name_id = n.id WHERE sn.scenario_id = s.id LIMIT 1)
),
standards_aggregated AS (
    SELECT 
        COALESCE(
            ARRAY_AGG(
                (sd.id, sd.standard_group_id, sd.name, sd.description, sd.points)::types.q_get_rubrics_list_v4_standard
                ORDER BY sd.standard_group_id, sd.name
            ),
            '{}'::types.q_get_rubrics_list_v4_standard[]
        ) as standards
    FROM standards_distinct sd
),
departments_distinct AS (
    SELECT DISTINCT ON (d.id)
        d.id, (SELECT n.name FROM department_names_junction dn JOIN names_resource n ON dn.name_id = n.id WHERE dn.department_id = d.id LIMIT 1), COALESCE((SELECT d2.description FROM department_descriptions_junction dd JOIN descriptions_resource d2 ON dd.description_id = d2.id WHERE dd.department_id = d.id LIMIT 1), '') as description
    FROM department_artifact d
    WHERE d.id IN (SELECT department_id FROM assigned_department_ids)
    ORDER BY d.id, (SELECT n.name FROM department_names_junction dn JOIN names_resource n ON dn.name_id = n.id WHERE dn.department_id = d.id LIMIT 1)
),
departments_aggregated AS (
    SELECT 
        COALESCE(
            ARRAY_AGG(
                (dd.id, dd.name, dd.description)::types.q_get_rubrics_list_v4_department
                ORDER BY dd.name
            ),
            '{}'::types.q_get_rubrics_list_v4_department[]
        ) as departments
    FROM departments_distinct dd
),
simulations_with_time_limit AS (
    SELECT DISTINCT ON (s.id)
        s.id, 
        (SELECT n.name FROM simulation_names_junction sn JOIN names_resource n ON sn.name_id = n.id WHERE sn.simulation_id = s.id LIMIT 1) as name, 
        COALESCE((SELECT (SELECT d.description FROM document_descriptions_junction dd JOIN descriptions_resource d ON dd.description_id = d.id WHERE dd.document_id = d.id LIMIT 1) FROM scenario_descriptions_junction sd JOIN descriptions_resource d ON sd.description_id = d.id WHERE sd.scenario_id = s.id LIMIT 1), '') as description,
        COALESCE(
            (SELECT SUM(stlr.time_limit_seconds)
             FROM simulation_scenario_time_limits_junction sstl
             JOIN scenario_time_limits_resource stlr ON stlr.id = sstl.scenario_time_limit_id
             JOIN simulation_scenarios_junction ss ON ss.simulation_id = sstl.simulation_id AND ss.scenario_id = stlr.scenario_id
             WHERE sstl.simulation_id = s.id AND sstl.active = true AND stlr.active = true AND EXISTS (SELECT 1 FROM simulation_scenario_flags_junction ssf JOIN scenario_flags_resource sfr ON ssf.scenario_flag_id = sfr.id JOIN flags_resource f ON sfr.flag_id = f.id WHERE ssf.simulation_id = ss.simulation_id AND sfr.scenario_id = ss.scenario_id AND f.name = 'scenario_active' AND ssf.value = true)),
            0
        )::int as time_limit
    FROM simulation_artifact s
    INNER JOIN simulation_department_access_for_rubrics sdar ON sdar.simulation_id = s.id AND sdar.has_access = true
    WHERE EXISTS (SELECT 1 FROM scenario_flags_junction sf JOIN flags_resource f ON sf.flag_id = f.id WHERE sf.scenario_id = s.id AND f.name = 'scenario_active' AND sf.value = true) 
      AND s.id IN (SELECT simulation_id FROM all_simulation_ids)
    ORDER BY s.id, (SELECT n.name FROM simulation_names_junction sn JOIN names_resource n ON sn.name_id = n.id WHERE sn.simulation_id = s.id LIMIT 1)
),
simulations_aggregated AS (
    SELECT 
        COALESCE(
            ARRAY_AGG(
                (swtl.id, swtl.name, swtl.description, swtl.time_limit)::types.q_get_rubrics_list_v4_simulation
                ORDER BY swtl.name
            ),
            '{}'::types.q_get_rubrics_list_v4_simulation[]
        ) as simulations
    FROM simulations_with_time_limit swtl
),
-- Filter simulation_options to only include assigned simulations (with disambiguation for duplicate names)
simulation_name_counts AS (
    SELECT (SELECT n.name FROM simulation_names_junction sn JOIN names_resource n ON sn.name_id = n.id WHERE sn.simulation_id = s.id LIMIT 1) as name, COUNT(*) as count
    FROM simulation_artifact s
    WHERE s.id IN (SELECT simulation_id FROM assigned_simulation_ids)
    GROUP BY (SELECT n.name FROM simulation_names_junction sn JOIN names_resource n ON sn.name_id = n.id WHERE sn.simulation_id = s.id LIMIT 1)
),
simulation_options_with_disambiguation AS (
    SELECT DISTINCT ON (s.id)
        s.id,
        CASE 
            WHEN snc.count > 1 THEN (SELECT n.name FROM simulation_names_junction sn JOIN names_resource n ON sn.name_id = n.id WHERE sn.simulation_id = s.id LIMIT 1) || ' (' || RIGHT(s.id::text, 8) || ')'
            ELSE (SELECT n.name FROM simulation_names_junction sn JOIN names_resource n ON sn.name_id = n.id WHERE sn.simulation_id = s.id LIMIT 1)
        END as name,
        COALESCE((SELECT (SELECT d.description FROM document_descriptions_junction dd JOIN descriptions_resource d ON dd.description_id = d.id WHERE dd.document_id = d.id LIMIT 1) FROM scenario_descriptions_junction sd JOIN descriptions_resource d ON sd.description_id = d.id WHERE sd.scenario_id = s.id LIMIT 1), '') as description,
        COALESCE(
            (SELECT SUM(stlr.time_limit_seconds)
             FROM simulation_scenario_time_limits_junction sstl
             JOIN scenario_time_limits_resource stlr ON stlr.id = sstl.scenario_time_limit_id
             JOIN simulation_scenarios_junction ss ON ss.simulation_id = sstl.simulation_id AND ss.scenario_id = stlr.scenario_id
             WHERE sstl.simulation_id = s.id AND sstl.active = true AND stlr.active = true AND EXISTS (SELECT 1 FROM simulation_scenario_flags_junction ssf JOIN scenario_flags_resource sfr ON ssf.scenario_flag_id = sfr.id JOIN flags_resource f ON sfr.flag_id = f.id WHERE ssf.simulation_id = ss.simulation_id AND sfr.scenario_id = ss.scenario_id AND f.name = 'scenario_active' AND ssf.value = true)),
            0
        )::int as time_limit
    FROM simulation_artifact s
    INNER JOIN simulation_department_access_for_rubrics sdar ON sdar.simulation_id = s.id AND sdar.has_access = true
    LEFT JOIN simulation_name_counts snc ON snc.name = (SELECT n.name FROM simulation_names_junction sn JOIN names_resource n ON sn.name_id = n.id WHERE sn.simulation_id = s.id LIMIT 1)
    WHERE EXISTS (SELECT 1 FROM scenario_flags_junction sf JOIN flags_resource f ON sf.flag_id = f.id WHERE sf.scenario_id = s.id AND f.name = 'scenario_active' AND sf.value = true) 
      AND s.id IN (SELECT simulation_id FROM assigned_simulation_ids)
    ORDER BY s.id, (SELECT n.name FROM simulation_names_junction sn JOIN names_resource n ON sn.name_id = n.id WHERE sn.simulation_id = s.id LIMIT 1)
),
simulation_options_aggregated AS (
    SELECT 
        COALESCE(
            ARRAY_AGG(
                (sod.id, sod.name, sod.description, sod.time_limit)::types.q_get_rubrics_list_v4_simulation
                ORDER BY sod.name
            ),
            '{}'::types.q_get_rubrics_list_v4_simulation[]
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
             rd.department_ids,
             rd.simulation_ids,
             rd.active_simulation_count,
             rd.total_simulation_links,
             rd.can_edit,
             rd.can_delete,
             rd.can_duplicate,
             COALESCE(rsgi.standard_group_ids, ARRAY[]::uuid[])
            )::types.q_get_rubrics_list_v4_rubric
            ORDER BY rd.name
        ),
        '{}'::types.q_get_rubrics_list_v4_rubric[]
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