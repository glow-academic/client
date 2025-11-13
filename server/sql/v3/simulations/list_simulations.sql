WITH user_departments AS (
    SELECT department_id
    FROM profile_departments
    WHERE profile_id = $1 AND active = true
),
simulation_scenarios AS (
    SELECT 
        ss.simulation_id,
        ARRAY_AGG(ss.scenario_id ORDER BY sc.name) as scenario_ids,
        COUNT(ss.scenario_id) as num_scenarios
    FROM simulation_scenarios ss
    JOIN scenarios sc ON sc.id = ss.scenario_id
    WHERE ss.active = true
    GROUP BY ss.simulation_id
),
simulation_attempts AS (
    SELECT 
        sa.simulation_id,
        COUNT(*) as attempt_count
    FROM simulation_attempts sa
    GROUP BY sa.simulation_id
),
simulation_active_cohort_links AS (
    SELECT 
        cs.simulation_id,
        COUNT(*) as active_cohort_count
    FROM cohort_simulations cs
    WHERE cs.active = true
    GROUP BY cs.simulation_id
),
simulation_all_cohort_links AS (
    SELECT 
        cs.simulation_id,
        COUNT(*) as total_cohort_links,
        COUNT(DISTINCT cs.cohort_id) as num_cohorts
    FROM cohort_simulations cs
    GROUP BY cs.simulation_id
),
simulation_cohorts_data AS (
    SELECT 
        cs.simulation_id,
        ARRAY_AGG(cs.cohort_id::text ORDER BY c.title) as cohort_ids
    FROM cohort_simulations cs
    JOIN cohorts c ON c.id = cs.cohort_id
    WHERE cs.active = true
    GROUP BY cs.simulation_id
),
simulation_departments_data AS (
    SELECT 
        sd.simulation_id,
        ARRAY_AGG(sd.department_id::text ORDER BY sd.created_at) as department_ids
    FROM simulation_departments sd
    WHERE sd.active = true
    GROUP BY sd.simulation_id
),
simulation_data AS (
    SELECT 
        s.id as simulation_id,
        s.title as name,
        s.description,
        stl.time_limit_seconds as time_limit,
        s.active,
        s.practice_simulation,
        s.rubric_id,
        s.updated_at,
        COALESCE(sdd.department_ids, NULL) as department_ids,
        COALESCE(ss.scenario_ids, ARRAY[]::uuid[]) as scenario_ids,
        COALESCE(ss.num_scenarios, 0) as num_scenarios,
        COALESCE(sa.attempt_count, 0) as attempt_count,
        COALESCE(sacl.active_cohort_count, 0) as active_cohort_count,
        COALESCE(salcl.total_cohort_links, 0) as total_cohort_links,
        COALESCE(salcl.num_cohorts, 0) as num_cohorts,
        COALESCE(scd.cohort_ids, ARRAY[]::text[]) as cohort_ids
    FROM simulations s
    LEFT JOIN simulation_departments sd ON sd.simulation_id = s.id AND sd.active = true
    LEFT JOIN simulation_departments_data sdd ON sdd.simulation_id = s.id
    LEFT JOIN simulation_time_limits stl ON stl.simulation_id = s.id AND stl.active = true
    LEFT JOIN simulation_scenarios ss ON ss.simulation_id = s.id
    LEFT JOIN simulation_attempts sa ON sa.simulation_id = s.id
    LEFT JOIN simulation_active_cohort_links sacl ON sacl.simulation_id = s.id
    LEFT JOIN simulation_all_cohort_links salcl ON salcl.simulation_id = s.id
    LEFT JOIN simulation_cohorts_data scd ON scd.simulation_id = s.id
    GROUP BY s.id, s.title, s.description, stl.time_limit_seconds, s.active, s.practice_simulation, 
             s.rubric_id, s.updated_at, sdd.department_ids, ss.scenario_ids, ss.num_scenarios, sa.attempt_count, 
             sacl.active_cohort_count, salcl.total_cohort_links, salcl.num_cohorts, scd.cohort_ids
    HAVING 
        -- Include if has matching department link OR has no department links at all (cross-dept)
        COUNT(sd.simulation_id) FILTER (WHERE sd.department_id IN (SELECT department_id FROM user_departments)) > 0
        OR NOT EXISTS (SELECT 1 FROM simulation_departments sd2 WHERE sd2.simulation_id = s.id AND sd2.active = true)
),
user_profile AS (
    SELECT role FROM profiles WHERE id = $1
),
all_scenario_ids AS (
    SELECT DISTINCT unnest(scenario_ids) as scenario_id
    FROM simulation_data
),
scenario_mapping_data AS (
    SELECT COALESCE(
        jsonb_object_agg(
            s.id::text,
            jsonb_build_object(
                'name', s.name,
                'description', COALESCE(sps.problem_statement, ''),
                'active', s.active,
                'persona_id', (
                    SELECT persona_id 
                    FROM scenario_personas sp 
                    WHERE sp.scenario_id = s.id AND sp.active = true 
                    LIMIT 1
                ),
                'persona_mapping', '{}'::jsonb,
                'document_mapping', '{}'::jsonb,
                'parameter_item_mapping', '{}'::jsonb,
                'parameter_item_ids', ARRAY[]::text[],
                'document_ids', ARRAY[]::text[]
            )
        ) FILTER (WHERE s.id IS NOT NULL AND st.parent_id IS NOT NULL),
        '{}'::jsonb
    ) as mapping
    FROM all_scenario_ids asi
    LEFT JOIN scenarios s ON s.id = asi.scenario_id
    LEFT JOIN scenario_problem_statements sps ON sps.scenario_id = s.id AND sps.active = true
    -- Only include root scenarios (parent_id = child_id in scenario_tree)
    LEFT JOIN scenario_tree st ON st.parent_id = s.id AND st.child_id = s.id
),
all_rubric_ids AS (
    SELECT DISTINCT rubric_id
    FROM simulation_data
    WHERE rubric_id IS NOT NULL
),
rubric_mapping_data AS (
    SELECT COALESCE(
        jsonb_object_agg(
            r.id::text,
            jsonb_build_object(
                'name', r.name,
                'description', COALESCE(r.description, '')
            )
        ) FILTER (WHERE r.id IS NOT NULL),
        '{}'::jsonb
    ) as mapping
    FROM all_rubric_ids ari
    LEFT JOIN rubrics r ON r.id = ari.rubric_id
),
department_mapping_data AS (
    SELECT COALESCE(
        jsonb_object_agg(
            d.id::text,
            jsonb_build_object(
                'name', d.title,
                'description', COALESCE(d.description, '')
            )
        ) FILTER (WHERE d.id IS NOT NULL),
        '{}'::jsonb
    ) as mapping
    FROM departments d
    WHERE d.id IN (SELECT department_id FROM user_departments)
),
all_cohort_ids AS (
    SELECT DISTINCT unnest(cohort_ids) as cohort_id
    FROM simulation_cohorts_data
    WHERE cohort_ids IS NOT NULL
),
cohort_mapping_data AS (
    SELECT COALESCE(
        jsonb_object_agg(
            c.id::text,
            jsonb_build_object(
                'name', c.title,
                'description', COALESCE(c.description, '')
            )
        ) FILTER (WHERE c.id IS NOT NULL),
        '{}'::jsonb
    ) as mapping
    FROM all_cohort_ids aci
    LEFT JOIN cohorts c ON c.id = aci.cohort_id::uuid
)
SELECT 
    sd.*,
    CASE 
        WHEN sd.active_cohort_count > 0 THEN false
        WHEN up.role IN ('admin', 'instructional', 'superadmin') THEN true
        ELSE false
    END as can_edit,
    CASE 
        WHEN sd.practice_simulation = true THEN false
        WHEN sd.total_cohort_links > 0 THEN false
        WHEN up.role IN ('admin', 'instructional', 'superadmin') THEN true
        ELSE false
    END as can_delete,
    CASE 
        WHEN up.role IN ('admin', 'instructional', 'superadmin') THEN true
        ELSE false
    END as can_duplicate,
    sm.mapping as scenario_mapping,
    rm.mapping as rubric_mapping,
    dm.mapping as department_mapping,
    cm.mapping as cohort_mapping
FROM simulation_data sd
CROSS JOIN user_profile up
CROSS JOIN scenario_mapping_data sm
CROSS JOIN rubric_mapping_data rm
CROSS JOIN department_mapping_data dm
CROSS JOIN cohort_mapping_data cm
ORDER BY sd.updated_at DESC NULLS LAST

