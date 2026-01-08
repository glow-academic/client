-- Get simulations list with permissions and relationships
-- Converted to function with composite types
-- 1) Drop function first (breaks dependency on types)
-- Drop all versions of the function using DO block to handle signature variations
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'api_list_simulations_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_list_simulations_v4(%s)', r.sig);
    END LOOP;
END $$;

-- 2) Drop types WITHOUT CASCADE
-- Drop types in correct order (parent types first, then child types)
-- Drop scenario first (depends on document), then document, then other types
DROP TYPE IF EXISTS types.q_list_simulations_v4_scenario;
DROP TYPE IF EXISTS types.q_list_simulations_v4_document;
DROP TYPE IF EXISTS types.q_list_simulations_v4_field;
DROP TYPE IF EXISTS types.q_list_simulations_v4_simulation;
DROP TYPE IF EXISTS types.q_list_simulations_v4_rubric;
DROP TYPE IF EXISTS types.q_list_simulations_v4_department;
DROP TYPE IF EXISTS types.q_list_simulations_v4_cohort;
DROP TYPE IF EXISTS types.q_list_simulations_v4_option;
DROP TYPE IF EXISTS types.q_list_simulations_v4_persona;

-- 3) Recreate types (define base types first, then composite types that reference them)
CREATE TYPE types.q_list_simulations_v4_persona AS (
    persona_id uuid,
    name text,
    description text,
    color text,
    icon text,
    image_model boolean
);

CREATE TYPE types.q_list_simulations_v4_document AS (
    document_id uuid,
    name text,
    description text
);

CREATE TYPE types.q_list_simulations_v4_field AS (
    field_id uuid,
    name text,
    description text,
    parameter_id uuid,
    parameter_name text
);

CREATE TYPE types.q_list_simulations_v4_scenario AS (
    scenario_id uuid,
    name text,
    description text,
    active boolean,
    persona_ids text[],
    persona_mapping types.q_list_simulations_v4_persona[],
    document_mapping types.q_list_simulations_v4_document[],
    parameter_item_mapping types.q_list_simulations_v4_field[],
    parameter_item_ids text[],
    document_ids text[]
);

CREATE TYPE types.q_list_simulations_v4_simulation AS (
    simulation_id uuid,
    name text,
    description text,
    department_ids text[],
    time_limit int,
    active boolean,
    practice_simulation boolean,
    can_edit boolean,
    can_delete boolean,
    can_duplicate boolean,
    scenario_ids uuid[],
    rubric_id uuid,
    num_cohorts int,
    cohort_ids text[],
    updated_at timestamptz
);

CREATE TYPE types.q_list_simulations_v4_rubric AS (
    rubric_id uuid,
    name text,
    description text
);

CREATE TYPE types.q_list_simulations_v4_department AS (
    department_id uuid,
    name text,
    description text
);

CREATE TYPE types.q_list_simulations_v4_cohort AS (
    cohort_id uuid,
    name text,
    description text
);

CREATE TYPE types.q_list_simulations_v4_option AS (
    value text,
    label text
);

-- 4) Recreate function
CREATE OR REPLACE FUNCTION api_list_simulations_v4(profile_id uuid)
RETURNS TABLE (
    actor_name text,
    simulations types.q_list_simulations_v4_simulation[],
    scenarios types.q_list_simulations_v4_scenario[],
    rubrics types.q_list_simulations_v4_rubric[],
    departments types.q_list_simulations_v4_department[],
    cohorts types.q_list_simulations_v4_cohort[],
    rubric_options types.q_list_simulations_v4_option[],
    cohort_options types.q_list_simulations_v4_option[],
    department_options types.q_list_simulations_v4_option[]
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
user_profile AS (
    SELECT 
        role,
        COALESCE((SELECT n.name FROM profile_names pn JOIN names n ON pn.name_id = n.id WHERE pn.profile_id = p.id AND pn.type = 'first' LIMIT 1) || ' ' || (SELECT n2.name FROM profile_names pn2 JOIN names n2 ON pn2.name_id = n2.id WHERE pn2.profile_id = p.id AND pn2.type = 'last' LIMIT 1), '') as actor_name
    FROM params x
    JOIN profiles p ON p.id = x.profile_id
),
simulation_scenarios_data AS (
    SELECT 
        ss.simulation_id,
        ARRAY_AGG(ss.scenario_id ORDER BY (SELECT n.name FROM scenario_names sn JOIN names n ON sn.name_id = n.id WHERE sn.scenario_id = sc.id LIMIT 1)) as scenario_ids,
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
        ARRAY_AGG(cs.cohort_id::text ORDER BY (SELECT n.name FROM cohort_names cn JOIN names n ON cn.name_id = n.id WHERE cn.cohort_id = c.id LIMIT 1)) as cohort_ids
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
        (SELECT n.name FROM simulation_names sn JOIN names n ON sn.name_id = n.id WHERE sn.simulation_id = s.id LIMIT 1) as name,
        (SELECT (SELECT d.description FROM document_descriptions dd JOIN descriptions d ON dd.description_id = d.id WHERE dd.document_id = d.id LIMIT 1) FROM scenario_descriptions sd JOIN descriptions d ON sd.description_id = d.id WHERE sd.scenario_id = s.id LIMIT 1),
        COALESCE(
            (SELECT SUM(stl.time_limit_seconds)
             FROM scenario_time_limits stl
             JOIN simulation_scenarios ss ON ss.simulation_id = stl.simulation_id AND ss.scenario_id = stl.scenario_id
             WHERE stl.simulation_id = s.id AND stl.active = true AND ss.active = true),
            0
        ) as time_limit,
        EXISTS (SELECT 1 FROM scenario_flags sf JOIN flags fl ON sf.flag_id = fl.id WHERE sf.scenario_id = s.id AND fl.name = 'active' AND sf.type = 'active'::type_scenario_flags AND sf.value = TRUE) as active,
        EXISTS (SELECT 1 FROM simulation_flags sf JOIN flags fl ON sf.flag_id = fl.id WHERE sf.simulation_id = s.id AND fl.name = 'practice' AND sf.type = 'practice'::type_simulation_flags AND sf.value = TRUE) as practice_simulation,
        (SELECT rga.rubric_id FROM simulation_scenarios ss_rubric 
         JOIN simulation_scenarios_rubric_grade_agents ssrga ON ssrga.simulation_id = ss_rubric.simulation_id AND ssrga.scenario_id = ss_rubric.scenario_id
         JOIN rubric_grade_agents rga ON rga.id = ssrga.rubric_grade_agent_id
         WHERE ss_rubric.simulation_id = s.id AND ss_rubric.active = true 
         ORDER BY ss_rubric.position 
         LIMIT 1) as rubric_id,
        s.updated_at,
        COALESCE(sdd.department_ids, NULL) as department_ids,
        COALESCE(ssd.scenario_ids, ARRAY[]::uuid[]) as scenario_ids,
        COALESCE(ssd.num_scenarios, 0) as num_scenarios,
        COALESCE(sa.attempt_count, 0) as attempt_count,
        COALESCE(sacl.active_cohort_count, 0) as active_cohort_count,
        COALESCE(salcl.total_cohort_links, 0) as total_cohort_links,
        COALESCE(salcl.num_cohorts, 0) as num_cohorts,
        COALESCE(scd.cohort_ids, ARRAY[]::text[]) as cohort_ids
    FROM simulations s
    LEFT JOIN simulation_departments sd ON sd.simulation_id = s.id AND sd.active = true
    LEFT JOIN simulation_departments_data sdd ON sdd.simulation_id = s.id
    LEFT JOIN simulation_scenarios_data ssd ON ssd.simulation_id = s.id
    LEFT JOIN simulation_attempts sa ON sa.simulation_id = s.id
    LEFT JOIN simulation_active_cohort_links sacl ON sacl.simulation_id = s.id
    LEFT JOIN simulation_all_cohort_links salcl ON salcl.simulation_id = s.id
    LEFT JOIN simulation_cohorts_data scd ON scd.simulation_id = s.id
    GROUP BY s.id, (SELECT n.name FROM simulation_names sn JOIN names n ON sn.name_id = n.id WHERE sn.simulation_id = s.id LIMIT 1), (SELECT (SELECT d.description FROM document_descriptions dd JOIN descriptions d ON dd.description_id = d.id WHERE dd.document_id = d.id LIMIT 1) FROM scenario_descriptions sd JOIN descriptions d ON sd.description_id = d.id WHERE sd.scenario_id = s.id LIMIT 1), EXISTS (SELECT 1 FROM scenario_flags sf JOIN flags fl ON sf.flag_id = fl.id WHERE sf.scenario_id = s.id AND fl.name = 'active' AND sf.type = 'active'::type_scenario_flags AND sf.value = TRUE), EXISTS (SELECT 1 FROM simulation_flags sf JOIN flags fl ON sf.flag_id = fl.id WHERE sf.simulation_id = s.id AND fl.name = 'practice' AND sf.type = 'practice'::type_simulation_flags AND sf.value = TRUE), 
             s.updated_at, sdd.department_ids, ssd.scenario_ids, ssd.num_scenarios, sa.attempt_count, 
             sacl.active_cohort_count, salcl.total_cohort_links, salcl.num_cohorts, scd.cohort_ids
    HAVING 
        -- Include if has matching department link OR has no department links at all (cross-dept)
        COUNT(sd.simulation_id) FILTER (WHERE sd.department_id IN (SELECT department_id FROM user_departments)) > 0
        OR NOT EXISTS (SELECT 1 FROM simulation_departments sd2 WHERE sd2.simulation_id = s.id AND sd2.active = true)
),
all_scenario_ids AS (
    SELECT DISTINCT unnest(scenario_ids) as scenario_id
    FROM simulation_data
),
scenario_personas_agg AS (
    SELECT 
        sp.scenario_id,
        ARRAY_AGG(sp.persona_id::text ORDER BY sp.persona_id) as persona_ids
    FROM scenario_personas sp
    WHERE sp.scenario_id IN (SELECT scenario_id FROM all_scenario_ids)
      AND sp.active = true
    GROUP BY sp.scenario_id
),
all_persona_ids AS (
    SELECT DISTINCT unnest(persona_ids)::uuid as persona_id
    FROM scenario_personas_agg
    WHERE persona_ids IS NOT NULL
),
image_model_check AS (
    SELECT 
        model_id,
        CASE WHEN COUNT(*) > 0 THEN true ELSE false END as image_model
    FROM model_modalities
    WHERE modality = 'image' AND is_input = false AND active = true
    GROUP BY model_id
),
persona_data AS (
    SELECT 
        p.id as persona_id,
        (SELECT n.name FROM persona_names pn JOIN names n ON pn.name_id = n.id WHERE pn.persona_id = p.id LIMIT 1),
        COALESCE((SELECT d.description FROM persona_descriptions pd JOIN descriptions d ON pd.description_id = d.id WHERE pd.persona_id = p.id LIMIT 1), '') as description,
        (SELECT c.hex_code FROM persona_colors pc JOIN colors c ON pc.color_id = c.id WHERE pc.persona_id = p.id LIMIT 1) as color,
        (SELECT i.name FROM persona_icons pi JOIN icons i ON pi.icon_id = i.id WHERE pi.persona_id = p.id LIMIT 1) as icon,
        false as image_model
    FROM all_persona_ids api
    JOIN personas p ON p.id = api.persona_id
),
scenario_base_data AS (
    SELECT 
        s.id as scenario_id,
        (SELECT n.name FROM scenario_names sn JOIN names n ON sn.name_id = n.id WHERE sn.scenario_id = s.id LIMIT 1),
        COALESCE(ps.problem_statement, '') as description,
        EXISTS (SELECT 1 FROM scenario_flags sf JOIN flags fl ON sf.flag_id = fl.id WHERE sf.scenario_id = s.id AND fl.name = 'active' AND sf.type = 'active'::type_scenario_flags AND sf.value = TRUE) as active,
        COALESCE(spa.persona_ids, ARRAY[]::text[]) as persona_ids,
        ARRAY[]::text[] as parameter_item_ids,
        ARRAY[]::text[] as document_ids
    FROM all_scenario_ids asi
    JOIN scenarios s ON s.id = asi.scenario_id
    LEFT JOIN scenario_problem_statements sps ON sps.scenario_id = s.id AND sps.active = true
    LEFT JOIN problem_statements ps ON ps.id = sps.problem_statement_id
    LEFT JOIN scenario_personas_agg spa ON spa.scenario_id = s.id
    LEFT JOIN scenario_tree st ON st.parent_id = s.id AND st.child_id = s.id
    WHERE st.parent_id IS NOT NULL
),
scenario_persona_mapping AS (
    SELECT 
        sp.scenario_id,
        ARRAY_AGG(
            (pd.persona_id, pd.name, pd.description, pd.color, pd.icon, pd.image_model)::types.q_list_simulations_v4_persona
            ORDER BY pd.name
        ) as personas
    FROM scenario_base_data sbd
    JOIN scenario_personas sp ON sp.scenario_id = sbd.scenario_id AND sp.active = true
    JOIN persona_data pd ON pd.persona_id = sp.persona_id
    GROUP BY sp.scenario_id
),
all_rubric_ids AS (
    SELECT DISTINCT rubric_id
    FROM simulation_data
    WHERE rubric_id IS NOT NULL
),
rubric_data AS (
    SELECT 
        r.id as rubric_id,
        (SELECT n.name FROM rubric_names rn JOIN names n ON rn.name_id = n.id WHERE rn.rubric_id = r.id LIMIT 1),
        COALESCE((SELECT d.description FROM rubric_descriptions rd JOIN descriptions d ON rd.description_id = d.id WHERE rd.rubric_id = r.id LIMIT 1), '') as description
    FROM all_rubric_ids ari
    JOIN rubrics r ON r.id = ari.rubric_id
),
all_cohort_ids AS (
    SELECT DISTINCT unnest(cohort_ids) as cohort_id
    FROM simulation_cohorts_data
    WHERE cohort_ids IS NOT NULL
),
cohort_data AS (
    SELECT 
        c.id as cohort_id,
        (SELECT n.name FROM cohort_names cn JOIN names n ON cn.name_id = n.id WHERE cn.cohort_id = c.id LIMIT 1) as name,
        COALESCE((SELECT d.description FROM cohort_descriptions cd JOIN descriptions d ON cd.description_id = d.id WHERE cd.cohort_id = c.id LIMIT 1), '') as description
    FROM all_cohort_ids aci
    JOIN cohorts c ON c.id = aci.cohort_id::uuid
),
department_data AS (
    SELECT 
        d.id as department_id,
        (SELECT n.name FROM department_names dn JOIN names n ON dn.name_id = n.id WHERE dn.department_id = d.id LIMIT 1) as name,
        COALESCE((SELECT d2.description FROM department_descriptions dd JOIN descriptions d2 ON dd.description_id = d2.id WHERE dd.department_id = d.id LIMIT 1), '') as description
    FROM departments d
    WHERE d.id IN (SELECT department_id FROM user_departments)
)
SELECT 
    up.actor_name::text as actor_name,
    -- Aggregate simulations
    COALESCE(
        (SELECT ARRAY_AGG(
            (simd.simulation_id, simd.name, simd.description, simd.department_ids, simd.time_limit,
             simd.active, simd.practice_simulation,
             CASE 
                 WHEN COALESCE(simd.department_ids, NULL) IS NULL AND up.role != 'superadmin' THEN false
                 WHEN up.role IN ('admin'::profile_role, 'instructional'::profile_role, 'superadmin'::profile_role) THEN true
                 ELSE false
             END,
             CASE 
                 WHEN COALESCE(simd.department_ids, NULL) IS NULL AND up.role != 'superadmin' THEN false
                 WHEN simd.practice_simulation = true THEN false
                 WHEN simd.total_cohort_links > 0 THEN false
                 WHEN up.role IN ('admin'::profile_role, 'instructional'::profile_role, 'superadmin'::profile_role) THEN true
                 ELSE false
             END,
             CASE 
                 WHEN up.role IN ('admin'::profile_role, 'instructional'::profile_role, 'superadmin'::profile_role) THEN true
                 ELSE false
             END,
             simd.scenario_ids, simd.rubric_id, simd.num_cohorts, simd.cohort_ids, simd.updated_at
            )::types.q_list_simulations_v4_simulation
            ORDER BY simd.updated_at DESC NULLS LAST
        ) FROM simulation_data simd),
        '{}'::types.q_list_simulations_v4_simulation[]
    ) as simulations,
    -- Aggregate scenarios
    COALESCE(
        (SELECT ARRAY_AGG(
            (sbd.scenario_id, sbd.name, sbd.description, sbd.active, sbd.persona_ids,
             COALESCE(spm.personas, ARRAY[]::types.q_list_simulations_v4_persona[]),
             ARRAY[]::types.q_list_simulations_v4_document[],
             ARRAY[]::types.q_list_simulations_v4_field[],
             sbd.parameter_item_ids,
             sbd.document_ids
            )::types.q_list_simulations_v4_scenario
            ORDER BY sbd.name
        ) FROM scenario_base_data sbd
        LEFT JOIN scenario_persona_mapping spm ON spm.scenario_id = sbd.scenario_id),
        '{}'::types.q_list_simulations_v4_scenario[]
    ) as scenarios,
    -- Aggregate rubrics
    COALESCE(
        (SELECT ARRAY_AGG(
            (rd.rubric_id, rd.name, rd.description)::types.q_list_simulations_v4_rubric
            ORDER BY rd.name
        ) FROM rubric_data rd),
        '{}'::types.q_list_simulations_v4_rubric[]
    ) as rubrics,
    -- Aggregate departments
    COALESCE(
        (SELECT ARRAY_AGG(
            (dd.department_id, dd.name, dd.description)::types.q_list_simulations_v4_department
            ORDER BY dd.name
        ) FROM department_data dd),
        '{}'::types.q_list_simulations_v4_department[]
    ) as departments,
    -- Aggregate cohorts
    COALESCE(
        (SELECT ARRAY_AGG(
            (cd.cohort_id, cd.name, cd.description)::types.q_list_simulations_v4_cohort
            ORDER BY cd.name
        ) FROM cohort_data cd),
        '{}'::types.q_list_simulations_v4_cohort[]
    ) as cohorts,
    -- Rubric options
    COALESCE(
        (SELECT ARRAY_AGG(
            (rd.rubric_id::text, rd.name)::types.q_list_simulations_v4_option
            ORDER BY rd.name
        ) FROM rubric_data rd),
        '{}'::types.q_list_simulations_v4_option[]
    ) as rubric_options,
    -- Cohort options
    COALESCE(
        (SELECT ARRAY_AGG(
            (cd.cohort_id::text, cd.name)::types.q_list_simulations_v4_option
            ORDER BY cd.name
        ) FROM cohort_data cd),
        '{}'::types.q_list_simulations_v4_option[]
    ) as cohort_options,
    -- Department options
    COALESCE(
        (SELECT ARRAY_AGG(
            (dd.department_id::text, dd.name)::types.q_list_simulations_v4_option
            ORDER BY dd.name
        ) FROM department_data dd),
        '{}'::types.q_list_simulations_v4_option[]
    ) as department_options
FROM user_profile up
$$;