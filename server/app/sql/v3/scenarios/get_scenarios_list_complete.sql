-- Get scenarios list with permissions
-- Converted to function with composite types
-- Uses safe drop/recreate pattern: drop function first, then types (no CASCADE), then recreate

BEGIN;

-- 1) Drop function first (breaks dependency on types)
DROP FUNCTION IF EXISTS api_list_scenarios_v3(uuid);

-- 2) Drop types WITHOUT CASCADE
-- If any other object depends on them, this will ERROR and stop the migration (good)
DROP TYPE IF EXISTS types.q_list_scenarios_v3_scenario;
DROP TYPE IF EXISTS types.q_list_scenarios_v3_objective;
DROP TYPE IF EXISTS types.q_list_scenarios_v3_field;
DROP TYPE IF EXISTS types.q_list_scenarios_v3_cohort;
DROP TYPE IF EXISTS types.q_list_scenarios_v3_persona;
DROP TYPE IF EXISTS types.q_list_scenarios_v3_simulation;
DROP TYPE IF EXISTS types.q_list_scenarios_v3_department;
DROP TYPE IF EXISTS types.q_list_scenarios_v3_option;

-- 3) Recreate types
CREATE TYPE types.q_list_scenarios_v3_scenario AS (
    scenario_id uuid,
    title text,
    problem_statement text,
    active boolean,
    generated boolean,
    parent_scenario_id uuid,
    department_ids text[],
    objective_ids text[],
    persona_ids text[],
    parameter_item_ids text[],
    simulation_ids text[],
    num_simulations bigint,
    can_edit boolean,
    can_delete boolean,
    can_duplicate boolean,
    cohort_ids text[],
    updated_at timestamptz
);

CREATE TYPE types.q_list_scenarios_v3_objective AS (
    objective_id text,
    name text,
    description text
);

CREATE TYPE types.q_list_scenarios_v3_field AS (
    field_id text,
    name text,
    description text,
    parameter_id text,
    parameter_name text
);

CREATE TYPE types.q_list_scenarios_v3_cohort AS (
    cohort_id text,
    name text,
    description text
);

CREATE TYPE types.q_list_scenarios_v3_persona AS (
    persona_id text,
    name text,
    description text,
    color text,
    icon text,
    image_model boolean
);

CREATE TYPE types.q_list_scenarios_v3_simulation AS (
    simulation_id text,
    name text,
    description text,
    time_limit bigint,
    department_ids text[]
);

CREATE TYPE types.q_list_scenarios_v3_department AS (
    department_id text,
    name text,
    description text
);

CREATE TYPE types.q_list_scenarios_v3_option AS (
    value text,
    label text
);

-- 4) Recreate function
CREATE OR REPLACE FUNCTION api_list_scenarios_v3(profile_id uuid)
RETURNS TABLE (
    actor_name text,
    scenarios types.q_list_scenarios_v3_scenario[],
    objectives types.q_list_scenarios_v3_objective[],
    fields types.q_list_scenarios_v3_field[],
    cohorts types.q_list_scenarios_v3_cohort[],
    personas types.q_list_scenarios_v3_persona[],
    simulations types.q_list_scenarios_v3_simulation[],
    departments types.q_list_scenarios_v3_department[],
    persona_options types.q_list_scenarios_v3_option[],
    simulation_options types.q_list_scenarios_v3_option[],
    department_options types.q_list_scenarios_v3_option[]
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
scenario_objectives AS (
    SELECT 
        so.scenario_id,
        ARRAY_AGG(o.id::text ORDER BY so.idx) as objective_ids
    FROM scenario_objectives so
    JOIN objectives o ON o.id = so.objective_id
    GROUP BY so.scenario_id
),
scenario_parameters AS (
    SELECT 
        sf.scenario_id,
        ARRAY_AGG(DISTINCT sf.field_id::text) as parameter_item_ids
    FROM scenario_fields sf
    WHERE sf.active = true
    GROUP BY sf.scenario_id
),
scenario_simulations AS (
    SELECT 
        ss.scenario_id,
        ARRAY_AGG(DISTINCT ss.simulation_id::text) as simulation_ids,
        COUNT(DISTINCT ss.simulation_id) as num_simulations
    FROM simulation_scenarios ss
    WHERE ss.active = true
    GROUP BY ss.scenario_id
),
scenario_all_simulation_links AS (
    SELECT 
        ss.scenario_id,
        COUNT(*) as total_links
    FROM simulation_scenarios ss
    GROUP BY ss.scenario_id
),
scenario_cohorts AS (
    SELECT DISTINCT
        ss.scenario_id,
        ARRAY_AGG(DISTINCT cs.cohort_id::text) as cohort_ids
    FROM simulation_scenarios ss
    JOIN cohort_simulations cs ON cs.simulation_id = ss.simulation_id
    WHERE ss.active = true AND cs.active = true
    GROUP BY ss.scenario_id
),
scenario_personas_agg AS (
    SELECT 
        sp.scenario_id,
        ARRAY_AGG(sp.persona_id::text ORDER BY sp.persona_id) as persona_ids
    FROM scenario_personas sp
    WHERE sp.active = true
    GROUP BY sp.scenario_id
),
user_profile AS (
    SELECT 
        role,
        COALESCE(first_name || ' ' || last_name, 'System') as actor_name
    FROM params x
    JOIN profiles ON profiles.id = x.profile_id
),
scenario_departments_data AS (
    SELECT 
        sd.scenario_id,
        ARRAY_AGG(sd.department_id::text ORDER BY sd.created_at) as department_ids
    FROM scenario_departments sd
    WHERE sd.active = true
    GROUP BY sd.scenario_id
),
scenario_attributes AS (
    SELECT DISTINCT ON (ss.scenario_id)
        ss.scenario_id,
        ss.hints_enabled,
        s.objectives_enabled,
        s.images_enabled as image_input_enabled
    FROM simulation_scenarios ss
    JOIN scenarios s ON s.id = ss.scenario_id
    WHERE ss.active = true
    ORDER BY ss.scenario_id, ss.position
),
scenario_data AS (
    SELECT 
        s.id as scenario_id,
        s.name as title,
        s.description,
        COALESCE(ps.problem_statement, '') as problem_statement,
        s.active,
        s.generated,
        s.updated_at,
        st.parent_id as parent_scenario_id,
        COALESCE(so.objective_ids, ARRAY[]::text[]) as objective_ids,
        COALESCE(spa.persona_ids, ARRAY[]::text[]) as persona_ids,
        COALESCE(spar.parameter_item_ids, ARRAY[]::text[]) as parameter_item_ids,
        COALESCE(ss.simulation_ids, ARRAY[]::text[]) as simulation_ids,
        COALESCE(ss.num_simulations, 0) as num_simulations,
        COALESCE(sc.cohort_ids, ARRAY[]::text[]) as cohort_ids,
        COALESCE(sdd.department_ids, NULL) as department_ids,
        COALESCE(sa.hints_enabled, false) as hints_enabled,
        COALESCE(sa.objectives_enabled, true) as objectives_enabled,
        COALESCE(sa.image_input_enabled, false) as image_input_enabled,
        CASE WHEN COUNT(sd.scenario_id) > 0 THEN true ELSE false END as has_dept_links,
        CASE 
            WHEN COALESCE(sdd.department_ids, NULL) IS NULL AND up.role != 'superadmin' THEN false
            WHEN up.role IN ('admin', 'instructional', 'superadmin') 
                 AND COALESCE(ss.num_simulations, 0) = 0 
            THEN true
            ELSE false
        END as can_edit,
        CASE 
            -- Can't delete if can't edit (stricter than can_edit)
            WHEN COALESCE(sdd.department_ids, NULL) IS NULL AND up.role != 'superadmin' THEN false
            WHEN up.role IN ('admin', 'instructional', 'superadmin') 
                 AND COALESCE(sal.total_links, 0) = 0 
            THEN true
            ELSE false
        END as can_delete,
        true as can_duplicate
    FROM scenarios s
    -- Only include root scenarios (parent_id = child_id in scenario_tree)
    JOIN scenario_tree root_check ON root_check.parent_id = s.id AND root_check.child_id = s.id
    LEFT JOIN scenario_departments sd ON sd.scenario_id = s.id AND sd.active = true
    LEFT JOIN scenario_departments_data sdd ON sdd.scenario_id = s.id
    LEFT JOIN scenario_tree st ON st.child_id = s.id AND st.parent_id != st.child_id
    LEFT JOIN scenario_problem_statements sps_j ON sps_j.scenario_id = s.id AND sps_j.active = true
    LEFT JOIN problem_statements ps ON ps.id = sps_j.problem_statement_id
    LEFT JOIN scenario_objectives so ON so.scenario_id = s.id
    LEFT JOIN scenario_parameters spar ON spar.scenario_id = s.id
    LEFT JOIN scenario_simulations ss ON ss.scenario_id = s.id
    LEFT JOIN scenario_all_simulation_links sal ON sal.scenario_id = s.id
    LEFT JOIN scenario_cohorts sc ON sc.scenario_id = s.id
    LEFT JOIN scenario_personas_agg spa ON spa.scenario_id = s.id
    LEFT JOIN scenario_attributes sa ON sa.scenario_id = s.id
    CROSS JOIN user_profile up
    GROUP BY s.id, s.name, s.description, ps.problem_statement, s.active, s.generated, s.updated_at, st.parent_id, 
             so.objective_ids, spa.persona_ids, spar.parameter_item_ids, ss.simulation_ids, ss.num_simulations, 
             sc.cohort_ids, sdd.department_ids, sal.total_links, up.role,
             sa.hints_enabled, sa.objectives_enabled, sa.image_input_enabled
    HAVING 
        -- Include if has matching department link OR has no department links at all (cross-dept)
        COUNT(sd.scenario_id) FILTER (WHERE sd.department_id IN (SELECT department_id FROM user_departments)) > 0
        OR NOT EXISTS (SELECT 1 FROM scenario_departments sd2 WHERE sd2.scenario_id = s.id AND sd2.active = true)
),
all_parameter_item_ids AS (
    SELECT DISTINCT unnest(parameter_item_ids) as parameter_item_id
    FROM scenario_data
),
all_cohort_ids AS (
    SELECT DISTINCT unnest(cohort_ids) as cohort_id
    FROM scenario_data
    WHERE cohort_ids IS NOT NULL
),
all_persona_ids AS (
    SELECT DISTINCT unnest(persona_ids)::uuid as persona_id
    FROM scenario_data
    WHERE persona_ids IS NOT NULL
),
all_simulation_ids AS (
    SELECT DISTINCT unnest(simulation_ids) as simulation_id
    FROM scenario_data
),
all_department_ids AS (
    SELECT DISTINCT unnest(department_ids) as department_id
    FROM scenario_data
    WHERE department_ids IS NOT NULL
)
SELECT 
    up.actor_name::text as actor_name,
    COALESCE(
        ARRAY_AGG(
            (sd.scenario_id, sd.title, sd.problem_statement, sd.active, sd.generated, 
             sd.parent_scenario_id, sd.department_ids, sd.objective_ids, sd.persona_ids, 
             sd.parameter_item_ids, sd.simulation_ids, sd.num_simulations, sd.can_edit, 
             sd.can_delete, sd.can_duplicate, sd.cohort_ids, sd.updated_at)::types.q_list_scenarios_v3_scenario
            ORDER BY sd.updated_at DESC NULLS LAST
        ),
        '{}'::types.q_list_scenarios_v3_scenario[]
    ) as scenarios,
    COALESCE(
        (SELECT ARRAY_AGG((o.id::text, o.objective, COALESCE(o.objective, ''))::types.q_list_scenarios_v3_objective)
         FROM objectives o
         WHERE o.id::text IN (SELECT DISTINCT unnest(sd.objective_ids) FROM scenario_data sd)),
        '{}'::types.q_list_scenarios_v3_objective[]
    ) as objectives,
    COALESCE(
        (SELECT ARRAY_AGG((f.id::text, f.name, COALESCE(f.description, ''), fp.parameter_id::text, p.name)::types.q_list_scenarios_v3_field)
         FROM fields f
         JOIN parameter_fields fp ON fp.field_id = f.id AND fp.active = true
         JOIN parameters p ON p.id = fp.parameter_id
         WHERE f.id::text IN (SELECT parameter_item_id FROM all_parameter_item_ids)),
        '{}'::types.q_list_scenarios_v3_field[]
    ) as fields,
    COALESCE(
        (SELECT ARRAY_AGG((c.id::text, c.title, COALESCE(c.description, ''))::types.q_list_scenarios_v3_cohort)
         FROM cohorts c
         WHERE c.id::text IN (SELECT cohort_id FROM all_cohort_ids)),
        '{}'::types.q_list_scenarios_v3_cohort[]
    ) as cohorts,
    COALESCE(
        (SELECT ARRAY_AGG((p.id::text, p.name, COALESCE(p.description, ''), p.color, p.icon, false)::types.q_list_scenarios_v3_persona)
         FROM personas p
         WHERE p.id IN (SELECT persona_id FROM all_persona_ids)),
        '{}'::types.q_list_scenarios_v3_persona[]
    ) as personas,
    COALESCE(
        (SELECT ARRAY_AGG(
            (s.id::text, s.title, COALESCE(s.description, ''), 
             COALESCE(
                 (SELECT SUM(stl.time_limit_seconds)
                  FROM scenario_time_limits stl
                  JOIN simulation_scenarios ss ON ss.simulation_id = stl.simulation_id AND ss.scenario_id = stl.scenario_id
                  WHERE stl.simulation_id = s.id AND stl.active = true AND ss.active = true),
                 0
             ),
             (SELECT ARRAY_AGG(sd.department_id::text ORDER BY sd.created_at)
              FROM simulation_departments sd
              WHERE sd.simulation_id = s.id AND sd.active = true)
            )::types.q_list_scenarios_v3_simulation
         )
         FROM all_simulation_ids asi
         LEFT JOIN simulations s ON s.id::text = asi.simulation_id),
        '{}'::types.q_list_scenarios_v3_simulation[]
    ) as simulations,
    COALESCE(
        (SELECT ARRAY_AGG((d.id::text, d.title, COALESCE(d.description, ''))::types.q_list_scenarios_v3_department)
         FROM departments d
         WHERE d.id::text IN (SELECT department_id FROM all_department_ids)
           AND d.id IN (SELECT department_id FROM user_departments)),
        '{}'::types.q_list_scenarios_v3_department[]
    ) as departments,
    -- Options arrays for UI (composite types)
    COALESCE(
        (SELECT ARRAY_AGG((p.id::text, p.name)::types.q_list_scenarios_v3_option ORDER BY p.name)
         FROM personas p
         WHERE p.id IN (SELECT persona_id FROM all_persona_ids)),
        '{}'::types.q_list_scenarios_v3_option[]
    ) as persona_options,
    COALESCE(
        (SELECT ARRAY_AGG((s.id::text, s.title)::types.q_list_scenarios_v3_option ORDER BY s.title)
         FROM all_simulation_ids asi
         LEFT JOIN simulations s ON s.id::text = asi.simulation_id),
        '{}'::types.q_list_scenarios_v3_option[]
    ) as simulation_options,
    COALESCE(
        (SELECT ARRAY_AGG((d.id::text, d.title)::types.q_list_scenarios_v3_option ORDER BY d.title)
         FROM departments d
         WHERE d.id::text IN (SELECT department_id FROM all_department_ids)
           AND d.id IN (SELECT department_id FROM user_departments)
           AND d.id::text IN (SELECT DISTINCT unnest(department_ids) FROM scenario_data WHERE department_ids IS NOT NULL)),
        '{}'::types.q_list_scenarios_v3_option[]
    ) as department_options
FROM scenario_data sd
CROSS JOIN user_profile up
GROUP BY up.actor_name
$$;

COMMIT;

