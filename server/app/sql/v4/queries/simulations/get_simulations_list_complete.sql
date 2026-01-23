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
    JOIN profile_departments_junction ON profile_departments_junction.profile_id = x.profile_id AND profile_departments_junction.active = true
),
user_profile AS (
    SELECT role, actor_name
    FROM view_user_profile_context
    WHERE profile_id = (SELECT profile_id FROM params)
),
simulation_scenarios_data AS (
    SELECT 
        ss.simulation_id,
        ARRAY_AGG(ss.scenario_id ORDER BY (SELECT n.name FROM scenario_names_junction sn JOIN names_resource n ON sn.name_id = n.id WHERE sn.scenario_id = sc.scenario_id LIMIT 1)) as scenario_ids,
        COUNT(ss.scenario_id) as num_scenarios
    FROM simulation_scenarios_junction ss
    JOIN scenarios_resource sc ON sc.id = ss.scenario_id
    WHERE EXISTS (SELECT 1 FROM simulation_scenario_flags_junction ssf JOIN scenario_flags_resource sfr ON ssf.scenario_flag_id = sfr.id JOIN flags_resource f ON sfr.flag_id = f.id WHERE ssf.simulation_id = ss.simulation_id 
        AND sfr.scenario_id = ss.scenario_id 
        AND f.name = 'scenario_active' 
        AND ssf.value = true)
    GROUP BY ss.simulation_id
),
attempts_entry AS (
    SELECT
        saj.simulation_id,
        COUNT(*) as attempt_count
    FROM attempts_entry sa
    JOIN simulation_attempts_junction saj ON saj.attempt_id = sa.id
    GROUP BY saj.simulation_id
),
simulation_active_cohort_links AS (
    SELECT 
        cs.simulation_id,
        COUNT(*) as active_cohort_count
    FROM cohort_simulations_junction cs
    WHERE cs.active = true
    GROUP BY cs.simulation_id
),
simulation_all_cohort_links AS (
    SELECT 
        cs.simulation_id,
        COUNT(*) as total_cohort_links,
        COUNT(DISTINCT cs.cohort_id) as num_cohorts
    FROM cohort_simulations_junction cs
    GROUP BY cs.simulation_id
),
simulation_cohorts_data AS (
    SELECT 
        cs.simulation_id,
        ARRAY_AGG(cs.cohort_id::text ORDER BY (SELECT n.name FROM cohort_names_junction cn JOIN names_resource n ON cn.name_id = n.id WHERE cn.cohort_id = c.id LIMIT 1)) as cohort_ids
    FROM cohort_simulations_junction cs
    JOIN cohort_artifact c ON c.id = cs.cohort_id
    WHERE cs.active = true
    GROUP BY cs.simulation_id
),
simulation_departments_data AS (
    SELECT 
        sd.simulation_id,
        ARRAY_AGG(sd.department_id::text ORDER BY sd.created_at) as department_ids
    FROM simulation_departments_junction sd
    WHERE sd.active = true
    GROUP BY sd.simulation_id
),
simulation_data AS (
    SELECT 
        s.id as simulation_id,
        (SELECT n.name FROM simulation_names_junction sn JOIN names_resource n ON sn.name_id = n.id WHERE sn.simulation_id = s.id LIMIT 1) as name,
        COALESCE(
            NULLIF(
                REGEXP_REPLACE(
                    TRIM((SELECT (SELECT d.description FROM document_descriptions_junction dd JOIN descriptions_resource d ON dd.description_id = d.id WHERE dd.document_id = d.id LIMIT 1) FROM scenario_descriptions_junction sd JOIN descriptions_resource d ON sd.description_id = d.id WHERE sd.scenario_id = s.id LIMIT 1)),
                    '^0$|\\s0$',
                    ''
                ),
                ''
            ),
            'No description'
        ) as description,
        COALESCE(
            (SELECT SUM(stlr.time_limit_seconds)
             FROM simulation_scenario_time_limits_junction sstl
             JOIN scenario_time_limits_resource stlr ON stlr.id = sstl.scenario_time_limit_id
             JOIN simulation_scenarios_junction ss ON ss.simulation_id = sstl.simulation_id AND ss.scenario_id = stlr.scenario_id
             WHERE sstl.simulation_id = s.id 
               AND sstl.active = true 
               AND stlr.active = true
               AND EXISTS (SELECT 1 FROM simulation_scenario_flags_junction ssf JOIN scenario_flags_resource sfr ON ssf.scenario_flag_id = sfr.id JOIN flags_resource f ON sfr.flag_id = f.id WHERE ssf.simulation_id = ss.simulation_id 
                   AND sfr.scenario_id = ss.scenario_id 
                   AND f.name = 'scenario_active' 
                   AND ssf.value = true)),
            0
        ) as time_limit,
        EXISTS (SELECT 1 FROM scenario_flags_junction sf JOIN flags_resource f ON sf.flag_id = f.id WHERE sf.scenario_id = s.id AND f.name = 'scenario_active' AND sf.value = TRUE) as active,
        EXISTS (SELECT 1 FROM simulation_flags_junction sf JOIN flags_resource f ON sf.flag_id = f.id WHERE sf.simulation_id = s.id AND f.name = 'practice' AND sf.value = TRUE) as practice_simulation,
        (SELECT srr.rubric_id FROM simulation_scenarios_junction ss_rubric 
         JOIN simulation_scenario_rubrics_junction ssr ON ssr.simulation_id = ss_rubric.simulation_id
         JOIN scenario_rubrics_resource srr ON srr.id = ssr.scenario_rubric_id AND srr.scenario_id = ss_rubric.scenario_id
         WHERE ss_rubric.simulation_id = s.id 
           AND EXISTS (SELECT 1 FROM simulation_scenario_flags_junction ssf JOIN scenario_flags_resource sfr ON ssf.scenario_flag_id = sfr.id JOIN flags_resource f ON sfr.flag_id = f.id WHERE ssf.simulation_id = ss_rubric.simulation_id 
               AND sfr.scenario_id = ss_rubric.scenario_id 
               AND f.name = 'simulation_active' 
               AND ssf.value = true)
         ORDER BY (SELECT spr.value FROM simulation_scenario_positions_junction ssp JOIN scenario_positions_resource spr ON spr.id = ssp.scenario_position_id WHERE ssp.simulation_id = ss_rubric.simulation_id AND spr.scenario_id = ss_rubric.scenario_id LIMIT 1)
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
    FROM simulation_artifact s
    LEFT JOIN simulation_departments_junction sd ON sd.simulation_id = s.id AND sd.active = true
    LEFT JOIN simulation_departments_data sdd ON sdd.simulation_id = s.id
    LEFT JOIN simulation_scenarios_data ssd ON ssd.simulation_id = s.id
    LEFT JOIN attempts_entry sa ON sa.simulation_id = s.id
    LEFT JOIN simulation_active_cohort_links sacl ON sacl.simulation_id = s.id
    LEFT JOIN simulation_all_cohort_links salcl ON salcl.simulation_id = s.id
    LEFT JOIN simulation_cohorts_data scd ON scd.simulation_id = s.id
    GROUP BY s.id, (SELECT n.name FROM simulation_names_junction sn JOIN names_resource n ON sn.name_id = n.id WHERE sn.simulation_id = s.id LIMIT 1), (SELECT (SELECT d.description FROM document_descriptions_junction dd JOIN descriptions_resource d ON dd.description_id = d.id WHERE dd.document_id = d.id LIMIT 1) FROM scenario_descriptions_junction sd JOIN descriptions_resource d ON sd.description_id = d.id WHERE sd.scenario_id = s.id LIMIT 1), EXISTS (SELECT 1 FROM scenario_flags_junction sf JOIN flags_resource f ON sf.flag_id = f.id WHERE sf.scenario_id = s.id AND f.name = 'scenario_active' AND sf.value = TRUE), EXISTS (SELECT 1 FROM simulation_flags_junction sf JOIN flags_resource f ON sf.flag_id = f.id WHERE sf.simulation_id = s.id AND f.name = 'practice' AND sf.value = TRUE), 
             s.updated_at, sdd.department_ids, ssd.scenario_ids, ssd.num_scenarios, sa.attempt_count, 
             sacl.active_cohort_count, salcl.total_cohort_links, salcl.num_cohorts, scd.cohort_ids
    HAVING 
        -- Include if has matching department link OR has no department links at all (cross-dept)
        COUNT(sd.simulation_id) FILTER (WHERE sd.department_id IN (SELECT department_id FROM user_departments)) > 0
        OR NOT EXISTS (SELECT 1 FROM simulation_departments_junction sd2 WHERE sd2.simulation_id = s.id AND sd2.active = true)
),
all_scenario_ids AS (
    SELECT DISTINCT unnest(scenario_ids) as scenario_id
    FROM simulation_data
),
scenario_personas_agg AS (
    SELECT 
        sp.scenario_id,
        ARRAY_AGG(sp.persona_id::text ORDER BY sp.persona_id) as persona_ids
    FROM scenario_personas_junction sp
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
        mm.model_id,
        CASE WHEN COUNT(*) > 0 THEN true ELSE false END as image_model
    FROM model_modalities_junction mm
    JOIN modalities_resource mr ON mr.id = mm.modality_id
    WHERE mr.modality = 'image' AND mm.type = 'output'::direction_type AND mm.active = true
    GROUP BY mm.model_id
),
persona_data AS (
    SELECT 
        p.id as persona_id,
        (SELECT n.name FROM persona_names_junction pn JOIN names_resource n ON pn.name_id = n.id WHERE pn.persona_id = p.id LIMIT 1),
        COALESCE((SELECT d.description FROM persona_descriptions_junction pd JOIN descriptions_resource d ON pd.description_id = d.id WHERE pd.persona_id = p.id LIMIT 1), '') as description,
        (SELECT c.hex_code FROM persona_colors_junction pc JOIN colors_resource c ON pc.color_id = c.id WHERE pc.persona_id = p.id LIMIT 1) as color,
        (SELECT i.name FROM persona_icons_junction pi JOIN icons_resource i ON pi.icon_id = i.id WHERE pi.persona_id = p.id LIMIT 1) as icon,
        false as image_model
    FROM all_persona_ids api
    JOIN personas_resource p ON p.id = api.persona_id
),
scenario_base_data AS (
    SELECT 
        s.id as scenario_id,
        (SELECT n.name FROM scenario_names_junction sn JOIN names_resource n ON sn.name_id = n.id WHERE sn.scenario_id = s.scenario_id LIMIT 1),
        COALESCE(ps.problem_statement, '') as description,
        EXISTS (SELECT 1 FROM scenario_flags_junction sf JOIN flags_resource f ON sf.flag_id = f.id WHERE sf.scenario_id = s.id AND f.name = 'scenario_active' AND sf.value = TRUE) as active,
        COALESCE(spa.persona_ids, ARRAY[]::text[]) as persona_ids,
        ARRAY[]::text[] as parameter_item_ids,
        ARRAY[]::text[] as document_ids
    FROM all_scenario_ids asi
    JOIN scenarios_resource s ON s.id = asi.scenario_id
    LEFT JOIN scenario_problem_statements_junction sps ON sps.scenario_id = s.id AND sps.active = true
    LEFT JOIN problem_statements_resource ps ON ps.id = sps.problem_statement_id
    LEFT JOIN scenario_personas_agg spa ON spa.scenario_id = s.id
    LEFT JOIN scenario_tree_junction st ON st.parent_id = s.id AND st.child_id = s.id
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
    JOIN scenario_personas_junction sp ON sp.scenario_id = sbd.scenario_id AND sp.active = true
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
        (SELECT n.name FROM rubric_names_junction rn JOIN names_resource n ON rn.name_id = n.id WHERE rn.rubric_id = r.id LIMIT 1),
        COALESCE((SELECT d.description FROM rubric_descriptions_junction rd JOIN descriptions_resource d ON rd.description_id = d.id WHERE rd.rubric_id = r.id LIMIT 1), '') as description
    FROM all_rubric_ids ari
    JOIN rubrics_resource r ON r.id = ari.rubric_id
),
all_cohort_ids AS (
    SELECT DISTINCT unnest(cohort_ids) as cohort_id
    FROM simulation_cohorts_data
    WHERE cohort_ids IS NOT NULL
),
cohort_data AS (
    SELECT 
        c.id as cohort_id,
        (SELECT n.name FROM cohort_names_junction cn JOIN names_resource n ON cn.name_id = n.id WHERE cn.cohort_id = c.id LIMIT 1) as name,
        COALESCE((SELECT d.description FROM cohort_descriptions_junction cd JOIN descriptions_resource d ON cd.description_id = d.id WHERE cd.cohort_id = c.id LIMIT 1), '') as description
    FROM all_cohort_ids aci
    JOIN cohort_artifact c ON c.id = aci.cohort_id::uuid
),
department_data AS (
    SELECT 
        d.id as department_id,
        (SELECT n.name FROM department_names_junction dn JOIN names_resource n ON dn.name_id = n.id WHERE dn.department_id = d.id LIMIT 1) as name,
        COALESCE((SELECT d2.description FROM department_descriptions_junction dd JOIN descriptions_resource d2 ON dd.description_id = d2.id WHERE dd.department_id = d.id LIMIT 1), '') as description
    FROM department_artifact d
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
                 WHEN up.role IN ('admin'::profile_type, 'instructional'::profile_type, 'superadmin'::profile_type) THEN true
                 ELSE false
             END,
             CASE 
                 WHEN COALESCE(simd.department_ids, NULL) IS NULL AND up.role != 'superadmin' THEN false
                 WHEN simd.practice_simulation = true THEN false
                 WHEN simd.total_cohort_links > 0 THEN false
                 WHEN up.role IN ('admin'::profile_type, 'instructional'::profile_type, 'superadmin'::profile_type) THEN true
                 ELSE false
             END,
             CASE 
                 WHEN up.role IN ('admin'::profile_type, 'instructional'::profile_type, 'superadmin'::profile_type) THEN true
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
