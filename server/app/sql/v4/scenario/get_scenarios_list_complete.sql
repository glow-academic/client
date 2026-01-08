-- Get scenarios list with permissions
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
        WHERE proname = 'api_list_scenarios_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_list_scenarios_v4(%s)', r.sig);
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
        WHERE typname LIKE 'q_list_scenarios_v4_%'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I', r.typname);
    END LOOP;
END $$;

-- 3) Recreate types
CREATE TYPE types.q_list_scenarios_v4_scenario AS (
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

CREATE TYPE types.q_list_scenarios_v4_objective AS (
    objective_id text,
    name text,
    description text
);

CREATE TYPE types.q_list_scenarios_v4_field AS (
    field_id text,
    name text,
    description text,
    parameter_id text,
    parameter_name text
);

CREATE TYPE types.q_list_scenarios_v4_cohort AS (
    cohort_id text,
    name text,
    description text
);

CREATE TYPE types.q_list_scenarios_v4_persona AS (
    persona_id text,
    name text,
    description text,
    color text,
    icon text,
    image_model boolean
);

CREATE TYPE types.q_list_scenarios_v4_simulation AS (
    simulation_id text,
    name text,
    description text,
    time_limit bigint,
    department_ids text[]
);

CREATE TYPE types.q_list_scenarios_v4_department AS (
    department_id text,
    name text,
    description text
);

CREATE TYPE types.q_list_scenarios_v4_option AS (
    value text,
    label text
);

-- 4) Recreate function
CREATE OR REPLACE FUNCTION api_list_scenarios_v4(profile_id uuid)
RETURNS TABLE (
    actor_name text,
    scenarios types.q_list_scenarios_v4_scenario[],
    objectives types.q_list_scenarios_v4_objective[],
    fields types.q_list_scenarios_v4_field[],
    cohorts types.q_list_scenarios_v4_cohort[],
    personas types.q_list_scenarios_v4_persona[],
    simulations types.q_list_scenarios_v4_simulation[],
    departments types.q_list_scenarios_v4_department[],
    persona_options types.q_list_scenarios_v4_option[],
    simulation_options types.q_list_scenarios_v4_option[],
    department_options types.q_list_scenarios_v4_option[]
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
        COALESCE(
            (SELECT n.name FROM profile_names pn JOIN names n ON pn.name_id = n.id WHERE pn.profile_id = (SELECT profile_id FROM params) AND pn.type = 'full'::type_profile_names LIMIT 1),
            (SELECT n1.name || ' ' || n2.name FROM profile_names pn1 JOIN names n1 ON pn1.name_id = n1.id JOIN profile_names pn2 ON pn2.profile_id = pn1.profile_id JOIN names n2 ON pn2.name_id = n2.id WHERE pn1.profile_id = (SELECT profile_id FROM params) AND pn1.type = 'first'::type_profile_names AND pn2.type = 'last'::type_profile_names LIMIT 1),
            'System'
        ) as actor_name
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
        EXISTS (SELECT 1 FROM scenario_flags sf JOIN flags fl ON sf.flag_id = fl.id WHERE sf.scenario_id = s.id AND fl.name = 'objectives_enabled' AND sf.type = 'objectives_enabled'::type_scenario_flags AND sf.value = TRUE) as objectives_enabled,
        EXISTS (SELECT 1 FROM scenario_flags sf JOIN flags fl ON sf.flag_id = fl.id WHERE sf.scenario_id = s.id AND fl.name = 'images_enabled' AND sf.type = 'images_enabled'::type_scenario_flags AND sf.value = TRUE) as image_input_enabled
    FROM simulation_scenarios ss
    JOIN scenarios s ON s.id = ss.scenario_id
    WHERE ss.active = true
    ORDER BY ss.scenario_id, ss.position
),
scenario_data AS (
    SELECT 
        s.id as scenario_id,
        (SELECT n.name FROM scenario_names sn JOIN names n ON sn.name_id = n.id WHERE sn.scenario_id = s.id LIMIT 1) as title,
        (SELECT (SELECT d.description FROM document_descriptions dd JOIN descriptions d ON dd.description_id = d.id WHERE dd.document_id = d.id LIMIT 1) FROM scenario_descriptions sd JOIN descriptions d ON sd.description_id = d.id WHERE sd.scenario_id = s.id LIMIT 1),
        COALESCE(ps.problem_statement, '') as problem_statement,
        EXISTS (SELECT 1 FROM scenario_flags sf JOIN flags fl ON sf.flag_id = fl.id WHERE sf.scenario_id = s.id AND fl.name = 'active' AND sf.type = 'active'::type_scenario_flags AND sf.value = TRUE) as active,
        false as generated,
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
            WHEN up.role IN ('admin'::profile_role, 'instructional'::profile_role, 'superadmin'::profile_role) 
                 AND COALESCE(ss.num_simulations, 0) = 0 
            THEN true
            ELSE false
        END as can_edit,
        CASE 
            -- Can't delete if can't edit (stricter than can_edit)
            WHEN COALESCE(sdd.department_ids, NULL) IS NULL AND up.role != 'superadmin' THEN false
            WHEN up.role IN ('admin'::profile_role, 'instructional'::profile_role, 'superadmin'::profile_role) 
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
    GROUP BY s.id, (SELECT n.name FROM scenario_names sn JOIN names n ON sn.name_id = n.id WHERE sn.scenario_id = s.id LIMIT 1), (SELECT (SELECT d.description FROM document_descriptions dd JOIN descriptions d ON dd.description_id = d.id WHERE dd.document_id = d.id LIMIT 1) FROM scenario_descriptions sd JOIN descriptions d ON sd.description_id = d.id WHERE sd.scenario_id = s.id LIMIT 1), ps.problem_statement, EXISTS (SELECT 1 FROM scenario_flags sf JOIN flags fl ON sf.flag_id = fl.id WHERE sf.scenario_id = s.id AND fl.name = 'active' AND sf.type = 'active'::type_scenario_flags AND sf.value = TRUE), s.updated_at, st.parent_id, 
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
             sd.can_delete, sd.can_duplicate, sd.cohort_ids, sd.updated_at)::types.q_list_scenarios_v4_scenario
            ORDER BY sd.updated_at DESC NULLS LAST
        ),
        '{}'::types.q_list_scenarios_v4_scenario[]
    ) as scenarios,
    COALESCE(
        (SELECT ARRAY_AGG((o.id::text, o.objective, COALESCE(o.objective, ''))::types.q_list_scenarios_v4_objective)
         FROM objectives o
         WHERE o.id::text IN (SELECT DISTINCT unnest(sd.objective_ids) FROM scenario_data sd)),
        '{}'::types.q_list_scenarios_v4_objective[]
    ) as objectives,
    COALESCE(
         (SELECT ARRAY_AGG((f.id::text, (SELECT n.name FROM field_names fn JOIN names n ON fn.name_id = n.id WHERE fn.field_id = f.id LIMIT 1), COALESCE((SELECT d.description FROM field_descriptions fd JOIN descriptions d ON fd.description_id = d.id WHERE fd.field_id = f.id LIMIT 1), ''), (SELECT pf.parameter_id FROM parameter_fields pf WHERE pf.field_id = f.id LIMIT 1)::text, (SELECT n.name FROM persona_names pn JOIN names n ON pn.name_id = n.id WHERE pn.persona_id = p.id LIMIT 1))::types.q_list_scenarios_v4_field)
         FROM fields f
         JOIN parameters p ON p.id = (SELECT pf.parameter_id FROM parameter_fields pf WHERE pf.field_id = f.id LIMIT 1)
         WHERE f.id::text IN (SELECT parameter_item_id FROM all_parameter_item_ids)),
        '{}'::types.q_list_scenarios_v4_field[]
    ) as fields,
    COALESCE(
        (SELECT ARRAY_AGG((c.id::text, (SELECT n.name FROM cohort_names cn JOIN names n ON cn.name_id = n.id WHERE cn.cohort_id = c.id LIMIT 1), COALESCE((SELECT d.description FROM cohort_descriptions cd JOIN descriptions d ON cd.description_id = d.id WHERE cd.cohort_id = c.id LIMIT 1), ''))::types.q_list_scenarios_v4_cohort)
         FROM cohorts c
         WHERE c.id::text IN (SELECT cohort_id FROM all_cohort_ids)),
        '{}'::types.q_list_scenarios_v4_cohort[]
    ) as cohorts,
    COALESCE(
        (SELECT ARRAY_AGG((p.id::text, (SELECT n.name FROM persona_names pn JOIN names n ON pn.name_id = n.id WHERE pn.persona_id = p.id LIMIT 1), COALESCE((SELECT d.description FROM persona_descriptions pd JOIN descriptions d ON pd.description_id = d.id WHERE pd.persona_id = p.id LIMIT 1), ''), (SELECT c.hex_code FROM persona_colors pc JOIN colors c ON pc.color_id = c.id WHERE pc.persona_id = p.id LIMIT 1), (SELECT i.name FROM persona_icons pi JOIN icons i ON pi.icon_id = i.id WHERE pi.persona_id = p.id LIMIT 1), false)::types.q_list_scenarios_v4_persona)
         FROM personas p
         WHERE p.id IN (SELECT persona_id FROM all_persona_ids)),
        '{}'::types.q_list_scenarios_v4_persona[]
    ) as personas,
    COALESCE(
        (SELECT ARRAY_AGG(
            (s.id::text, (SELECT n.name FROM simulation_names sn JOIN names n ON sn.name_id = n.id WHERE sn.simulation_id = s.id LIMIT 1), COALESCE((SELECT (SELECT d.description FROM document_descriptions dd JOIN descriptions d ON dd.description_id = d.id WHERE dd.document_id = d.id LIMIT 1) FROM scenario_descriptions sd JOIN descriptions d ON sd.description_id = d.id WHERE sd.scenario_id = s.id LIMIT 1), ''), 
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
            )::types.q_list_scenarios_v4_simulation
         )
         FROM all_simulation_ids asi
         LEFT JOIN simulations s ON s.id::text = asi.simulation_id),
        '{}'::types.q_list_scenarios_v4_simulation[]
    ) as simulations,
    COALESCE(
        (SELECT ARRAY_AGG((d.id::text, (SELECT n.name FROM department_names dn JOIN names n ON dn.name_id = n.id WHERE dn.department_id = d.id LIMIT 1), COALESCE((SELECT d.description FROM document_descriptions dd JOIN descriptions d ON dd.description_id = d.id WHERE dd.document_id = d.id LIMIT 1), ''))::types.q_list_scenarios_v4_department)
         FROM departments d
         WHERE d.id::text IN (SELECT department_id FROM all_department_ids)
           AND d.id IN (SELECT department_id FROM user_departments)),
        '{}'::types.q_list_scenarios_v4_department[]
    ) as departments,
    -- Options arrays for UI (composite types)
    COALESCE(
        (SELECT ARRAY_AGG((p.id::text, (SELECT n.name FROM persona_names pn JOIN names n ON pn.name_id = n.id WHERE pn.persona_id = p.id LIMIT 1))::types.q_list_scenarios_v4_option ORDER BY (SELECT n.name FROM persona_names pn JOIN names n ON pn.name_id = n.id WHERE pn.persona_id = p.id LIMIT 1))
         FROM personas p
         WHERE p.id IN (SELECT persona_id FROM all_persona_ids)),
        '{}'::types.q_list_scenarios_v4_option[]
    ) as persona_options,
    COALESCE(
        (SELECT ARRAY_AGG((s.id::text, (SELECT n.name FROM simulation_names sn JOIN names n ON sn.name_id = n.id WHERE sn.simulation_id = s.id LIMIT 1))::types.q_list_scenarios_v4_option ORDER BY (SELECT n.name FROM simulation_names sn JOIN names n ON sn.name_id = n.id WHERE sn.simulation_id = s.id LIMIT 1))
         FROM all_simulation_ids asi
         LEFT JOIN simulations s ON s.id::text = asi.simulation_id),
        '{}'::types.q_list_scenarios_v4_option[]
    ) as simulation_options,
    COALESCE(
        (SELECT ARRAY_AGG((d.id::text, (SELECT n.name FROM department_names dn JOIN names n ON dn.name_id = n.id WHERE dn.department_id = d.id LIMIT 1))::types.q_list_scenarios_v4_option ORDER BY (SELECT n.name FROM department_names dn JOIN names n ON dn.name_id = n.id WHERE dn.department_id = d.id LIMIT 1))
         FROM departments d
         WHERE d.id::text IN (SELECT department_id FROM all_department_ids)
           AND d.id IN (SELECT department_id FROM user_departments)
           AND d.id::text IN (SELECT DISTINCT unnest(department_ids) FROM scenario_data WHERE department_ids IS NOT NULL)),
        '{}'::types.q_list_scenarios_v4_option[]
    ) as department_options
FROM scenario_data sd
CROSS JOIN user_profile up
GROUP BY up.actor_name
$$;