-- Get scenarios list with permissions
-- Resource-first: only touches scenario_artifact + scenario's own junctions + resource tables
-- No cross-entity artifact tables (simulation_artifact, cohort_artifact, etc.)
-- Removed: view_scenario_edit_state, simulation_scenarios_junction, cohort_simulations_junction
-- Uses: simulations_resource.scenario_ids (migration 426), cohorts_resource.simulation_ids
-- 1) Drop function first (breaks dependency on types)
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
    field_ids text[],
    simulation_ids text[],
    num_simulations int,
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
    description text
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
    icon text
);

CREATE TYPE types.q_list_scenarios_v4_simulation AS (
    simulation_id text,
    name text,
    description text,
    department_ids text[]
);

CREATE TYPE types.q_list_scenarios_v4_department AS (
    department_id text,
    name text,
    description text
);

CREATE TYPE types.q_list_scenarios_v4_option AS (
    value text,
    label text,
    count bigint
);

-- 4) Recreate function
CREATE OR REPLACE FUNCTION api_list_scenarios_v4(
    profile_id uuid,
    search text DEFAULT NULL,
    persona_ids uuid[] DEFAULT NULL,
    simulation_ids uuid[] DEFAULT NULL,
    filter_department_ids uuid[] DEFAULT NULL,
    persona_search text DEFAULT NULL,
    simulation_search text DEFAULT NULL,
    department_search text DEFAULT NULL,
    page_size int DEFAULT 10,
    page_offset int DEFAULT 0
)
RETURNS TABLE (
    actor_name text,
    user_role text,
    scenarios types.q_list_scenarios_v4_scenario[],
    objectives types.q_list_scenarios_v4_objective[],
    fields types.q_list_scenarios_v4_field[],
    cohorts types.q_list_scenarios_v4_cohort[],
    personas types.q_list_scenarios_v4_persona[],
    simulations types.q_list_scenarios_v4_simulation[],
    departments types.q_list_scenarios_v4_department[],
    persona_options types.q_list_scenarios_v4_option[],
    simulation_options types.q_list_scenarios_v4_option[],
    department_options types.q_list_scenarios_v4_option[],
    total_count bigint
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
    SELECT role, COALESCE(NULLIF(actor_name, ''), 'System') as actor_name
    FROM view_user_profile_context
    WHERE profile_id = (SELECT profile_id FROM params)
),
-- Objectives per scenario (scenario's own junction)
scenario_objectives_agg AS (
    SELECT
        so.scenario_id,
        ARRAY_AGG(so.objective_id::text ORDER BY so.idx) as objective_ids
    FROM scenario_objectives_junction so
    WHERE so.active = true
    GROUP BY so.scenario_id
),
-- Fields per scenario via parameter_fields_resource.field_id -> fields_resource.id
scenario_fields_data AS (
    SELECT
        spfj.scenario_id,
        ARRAY_AGG(DISTINCT fr.id::text) as field_ids
    FROM scenario_parameter_fields_junction spfj
    JOIN parameter_fields_resource pfr ON pfr.id = spfj.parameter_field_id
    JOIN fields_resource fr ON fr.id = pfr.field_id
    WHERE spfj.active = true
    GROUP BY spfj.scenario_id
),
-- Simulations per scenario via denormalized simulations_resource.scenario_ids
-- Path: scenario_artifact -> scenario_scenarios_junction -> scenarios_resource.id -> simulations_resource WHERE scenarios_resource.id = ANY(scenario_ids)
scenario_simulations AS (
    SELECT
        ssj.scenario_id,
        ARRAY_AGG(DISTINCT sim_r.id::text) as simulation_ids,
        COUNT(DISTINCT sim_r.id)::int as num_simulations
    FROM scenario_scenarios_junction ssj
    JOIN simulations_resource sim_r ON ssj.scenarios_id = ANY(sim_r.scenario_ids)
    WHERE sim_r.active = true
    GROUP BY ssj.scenario_id
),
-- Cohorts per scenario via simulations_resource -> cohorts_resource.simulation_ids
scenario_cohorts AS (
    SELECT
        ssj.scenario_id,
        ARRAY_AGG(DISTINCT cr.id::text) as cohort_ids
    FROM scenario_scenarios_junction ssj
    JOIN simulations_resource sim_r ON ssj.scenarios_id = ANY(sim_r.scenario_ids)
    JOIN cohorts_resource cr ON sim_r.id = ANY(cr.simulation_ids)
    WHERE sim_r.active = true AND cr.active = true
    GROUP BY ssj.scenario_id
),
-- Department IDs per scenario (scenario's own junction)
scenario_departments_data AS (
    SELECT
        sd.scenario_id,
        ARRAY_AGG(sd.department_id::text ORDER BY sd.created_at) as department_ids
    FROM scenario_departments_junction sd
    WHERE sd.active = true
    GROUP BY sd.scenario_id
),
-- Usage data (replaces view_scenario_edit_state) — computed from resource tables
-- active_usage_count: simulation count only when scenario has scenario_active flag
-- total_simulation_links: total simulation references
scenario_usage AS (
    SELECT
        ssj.scenario_id,
        COUNT(DISTINCT sim_r.id)::int as total_simulation_links,
        CASE WHEN EXISTS(
            SELECT 1 FROM scenario_flags_junction sf
            JOIN flags_resource f ON f.id = sf.flag_id
            WHERE sf.scenario_id = ssj.scenario_id
              AND f.name = 'scenario_active'
              AND sf.value = true
        ) THEN COUNT(DISTINCT sim_r.id)::int
        ELSE 0
        END as active_usage_count
    FROM scenario_scenarios_junction ssj
    LEFT JOIN simulations_resource sim_r ON ssj.scenarios_id = ANY(sim_r.scenario_ids) AND sim_r.active = true
    GROUP BY ssj.scenario_id
),
-- Main scenario data with permissions
scenario_data AS (
    SELECT
        s.id as scenario_id,
        (SELECT n.name FROM scenario_names_junction sn JOIN names_resource n ON sn.name_id = n.id WHERE sn.scenario_id = s.id LIMIT 1) as title,
        COALESCE(ps.problem_statement, '') as problem_statement,
        EXISTS (SELECT 1 FROM scenario_flags_junction sf JOIN flags_resource f ON sf.flag_id = f.id WHERE sf.scenario_id = s.id AND f.name = 'scenario_active' AND sf.value = TRUE) as active,
        s.generated as generated,
        s.updated_at,
        st.parent_id as parent_scenario_id,
        COALESCE(sdd.department_ids, NULL) as department_ids,
        COALESCE(so.objective_ids, ARRAY[]::text[]) as objective_ids,
        COALESCE(sr.persona_ids::text[], ARRAY[]::text[]) as persona_ids,
        COALESCE(sfd.field_ids, ARRAY[]::text[]) as field_ids,
        COALESCE(ss.simulation_ids, ARRAY[]::text[]) as simulation_ids,
        COALESCE(ss.num_simulations, 0) as num_simulations,
        COALESCE(sc.cohort_ids, ARRAY[]::text[]) as cohort_ids,
        -- Permissions (replaces view_scenario_edit_state)
        CASE
            WHEN COALESCE(su.active_usage_count, 0) > 0 THEN false
            WHEN sdd.department_ids IS NULL AND up.role != 'superadmin' THEN false
            WHEN up.role IN ('admin'::profile_type, 'instructional'::profile_type, 'superadmin'::profile_type) THEN true
            ELSE false
        END as can_edit,
        CASE
            WHEN COALESCE(su.active_usage_count, 0) > 0 THEN false
            WHEN sdd.department_ids IS NULL AND up.role != 'superadmin' THEN false
            WHEN up.role IN ('admin'::profile_type, 'instructional'::profile_type, 'superadmin'::profile_type)
                 AND COALESCE(su.total_simulation_links, 0) = 0 THEN true
            ELSE false
        END as can_delete,
        true as can_duplicate
    FROM scenario_artifact s
    -- Root check: scenarios with self-referencing entry in scenario_tree_junction
    JOIN scenario_tree_junction root_check ON root_check.parent_id = s.id AND root_check.child_id = s.id
    -- Bridge to scenarios_resource for denormalized persona_ids
    LEFT JOIN scenario_scenarios_junction ssj ON ssj.scenario_id = s.id
    LEFT JOIN scenarios_resource sr ON sr.id = ssj.scenarios_id
    -- Department scoping (for HAVING clause)
    LEFT JOIN scenario_departments_junction sd ON sd.scenario_id = s.id AND sd.active = true
    LEFT JOIN scenario_departments_data sdd ON sdd.scenario_id = s.id
    -- Parent-child linkage
    LEFT JOIN scenario_tree_junction st ON st.child_id = s.id AND st.parent_id != st.child_id
    -- Problem statement
    LEFT JOIN scenario_problem_statements_junction sps_j ON sps_j.scenario_id = s.id AND sps_j.active = true
    LEFT JOIN problem_statements_resource ps ON ps.id = sps_j.problem_statement_id
    -- Pre-aggregated data
    LEFT JOIN scenario_objectives_agg so ON so.scenario_id = s.id
    LEFT JOIN scenario_fields_data sfd ON sfd.scenario_id = s.id
    LEFT JOIN scenario_simulations ss ON ss.scenario_id = s.id
    LEFT JOIN scenario_cohorts sc ON sc.scenario_id = s.id
    LEFT JOIN scenario_usage su ON su.scenario_id = s.id
    CROSS JOIN user_profile up
    GROUP BY s.id,
        (SELECT n.name FROM scenario_names_junction sn JOIN names_resource n ON sn.name_id = n.id WHERE sn.scenario_id = s.id LIMIT 1),
        ps.problem_statement,
        EXISTS (SELECT 1 FROM scenario_flags_junction sf JOIN flags_resource f ON sf.flag_id = f.id WHERE sf.scenario_id = s.id AND f.name = 'scenario_active' AND sf.value = TRUE),
        s.generated, s.updated_at, st.parent_id, sr.persona_ids,
        sdd.department_ids, so.objective_ids, sfd.field_ids,
        ss.simulation_ids, ss.num_simulations, sc.cohort_ids,
        su.active_usage_count, su.total_simulation_links, up.role
    HAVING
        -- Department scoping: include if has matching department link OR has no department links at all
        COUNT(sd.scenario_id) FILTER (WHERE sd.department_id IN (SELECT department_id FROM user_departments)) > 0
        OR NOT EXISTS (SELECT 1 FROM scenario_departments_junction sd2 WHERE sd2.scenario_id = s.id AND sd2.active = true)
),
-- Server-side filtering on root scenarios only
filtered_roots AS (
    SELECT sd.*
    FROM scenario_data sd
    WHERE sd.parent_scenario_id IS NULL
      AND (search IS NULL OR LOWER(sd.title) LIKE '%' || LOWER(search) || '%' OR LOWER(sd.problem_statement) LIKE '%' || LOWER(search) || '%')
      AND (api_list_scenarios_v4.persona_ids IS NULL OR sd.persona_ids && api_list_scenarios_v4.persona_ids::text[])
      AND (api_list_scenarios_v4.simulation_ids IS NULL OR sd.simulation_ids && api_list_scenarios_v4.simulation_ids::text[])
      AND (filter_department_ids IS NULL OR sd.department_ids && filter_department_ids::text[])
),
filtered_count AS (
    SELECT COUNT(*)::bigint as total FROM filtered_roots
),
paginated_roots AS (
    SELECT * FROM filtered_roots
    ORDER BY updated_at DESC NULLS LAST
    LIMIT page_size OFFSET page_offset
),
-- Include paginated roots and their children
page_scenarios AS (
    SELECT sd.* FROM paginated_roots sd
    UNION ALL
    SELECT sd.* FROM scenario_data sd
    WHERE sd.parent_scenario_id IN (SELECT scenario_id FROM paginated_roots)
),
-- Distinct IDs for page-level hydration
all_persona_ids AS (
    SELECT DISTINCT unnest(persona_ids)::uuid as persona_id
    FROM page_scenarios WHERE persona_ids IS NOT NULL
),
all_simulation_ids AS (
    SELECT DISTINCT unnest(simulation_ids) as simulation_id
    FROM page_scenarios
),
all_department_ids AS (
    SELECT DISTINCT unnest(department_ids) as department_id
    FROM page_scenarios WHERE department_ids IS NOT NULL
),
-- Distinct IDs for filter dropdown options (from ALL visible roots, not just page)
all_persona_ids_options AS (
    SELECT DISTINCT unnest(persona_ids)::uuid as persona_id
    FROM scenario_data WHERE persona_ids IS NOT NULL AND parent_scenario_id IS NULL
),
all_simulation_ids_options AS (
    SELECT DISTINCT unnest(simulation_ids) as simulation_id
    FROM scenario_data WHERE parent_scenario_id IS NULL
),
all_department_ids_options AS (
    SELECT DISTINCT unnest(department_ids) as department_id
    FROM scenario_data WHERE department_ids IS NOT NULL AND parent_scenario_id IS NULL
)
SELECT
    up.actor_name::text as actor_name,
    up.role::text as user_role,
    -- Scenarios (paginated roots + children)
    COALESCE(
        ARRAY_AGG(
            (sd.scenario_id, sd.title, sd.problem_statement, sd.active, sd.generated,
             sd.parent_scenario_id, sd.department_ids, sd.objective_ids, sd.persona_ids,
             sd.field_ids, sd.simulation_ids, sd.num_simulations, sd.can_edit,
             sd.can_delete, sd.can_duplicate, sd.cohort_ids, sd.updated_at)::types.q_list_scenarios_v4_scenario
            ORDER BY sd.parent_scenario_id NULLS FIRST, sd.updated_at DESC NULLS LAST
        ),
        '{}'::types.q_list_scenarios_v4_scenario[]
    ) as scenarios,
    -- Objectives hydration (from objectives_resource)
    COALESCE(
        (SELECT ARRAY_AGG((o.id::text, o.objective, COALESCE(o.objective, ''))::types.q_list_scenarios_v4_objective)
         FROM objectives_resource o
         WHERE o.id::text IN (SELECT DISTINCT unnest(sd2.objective_ids) FROM page_scenarios sd2)),
        '{}'::types.q_list_scenarios_v4_objective[]
    ) as objectives,
    -- Fields hydration (from fields_resource directly — denormalized name/description)
    COALESCE(
        (SELECT ARRAY_AGG((fr.id::text, fr.name, COALESCE(fr.description, ''))::types.q_list_scenarios_v4_field)
         FROM fields_resource fr
         WHERE fr.id::text IN (SELECT DISTINCT unnest(sd2.field_ids) FROM page_scenarios sd2)),
        '{}'::types.q_list_scenarios_v4_field[]
    ) as fields,
    -- Cohorts hydration (from cohorts_resource directly — denormalized name/description)
    COALESCE(
        (SELECT ARRAY_AGG((cr.id::text, cr.name, COALESCE(cr.description, ''))::types.q_list_scenarios_v4_cohort)
         FROM cohorts_resource cr
         WHERE cr.id::text IN (SELECT DISTINCT unnest(sd2.cohort_ids) FROM page_scenarios sd2 WHERE sd2.cohort_ids IS NOT NULL)),
        '{}'::types.q_list_scenarios_v4_cohort[]
    ) as cohorts,
    -- Personas hydration (persona junctions for name/description/color/icon — hydration layer only)
    COALESCE(
        (SELECT ARRAY_AGG(
            (pr.id::text,
             (SELECT n.name FROM persona_names_junction pn JOIN names_resource n ON pn.name_id = n.id WHERE pn.persona_id = ppj.persona_id LIMIT 1),
             COALESCE((SELECT d.description FROM persona_descriptions_junction pd JOIN descriptions_resource d ON pd.description_id = d.id WHERE pd.persona_id = ppj.persona_id LIMIT 1), ''),
             (SELECT c.hex_code FROM persona_colors_junction pc JOIN colors_resource c ON pc.color_id = c.id WHERE pc.persona_id = ppj.persona_id LIMIT 1),
             (SELECT i.name FROM persona_icons_junction pi JOIN icons_resource i ON pi.icon_id = i.id WHERE pi.persona_id = ppj.persona_id LIMIT 1)
            )::types.q_list_scenarios_v4_persona
         )
         FROM personas_resource pr
         JOIN persona_personas_junction ppj ON ppj.personas_id = pr.id
         WHERE pr.id IN (SELECT persona_id FROM all_persona_ids)),
        '{}'::types.q_list_scenarios_v4_persona[]
    ) as personas,
    -- Simulations hydration (from simulations_resource directly — denormalized name/description/department_ids)
    COALESCE(
        (SELECT ARRAY_AGG(
            (sim_r.id::text, sim_r.name, COALESCE(sim_r.description, ''),
             sim_r.department_ids::text[])::types.q_list_scenarios_v4_simulation
         )
         FROM simulations_resource sim_r
         WHERE sim_r.id::text IN (SELECT simulation_id FROM all_simulation_ids)),
        '{}'::types.q_list_scenarios_v4_simulation[]
    ) as simulations,
    -- Departments hydration (from departments_resource directly — denormalized name/description)
    COALESCE(
        (SELECT ARRAY_AGG(
            (dr.id::text, dr.name, COALESCE(dr.description, ''))::types.q_list_scenarios_v4_department
         )
         FROM departments_resource dr
         WHERE dr.id IN (SELECT department_id FROM user_departments)),
        '{}'::types.q_list_scenarios_v4_department[]
    ) as departments,
    -- Persona filter options
    COALESCE(
        (SELECT ARRAY_AGG(
            (pr.id::text, pn_name.name, (SELECT COUNT(*) FROM scenario_data sd WHERE sd.parent_scenario_id IS NULL AND pr.id::text = ANY(sd.persona_ids)))::types.q_list_scenarios_v4_option
            ORDER BY pn_name.name
         )
         FROM personas_resource pr
         JOIN persona_personas_junction ppj ON ppj.personas_id = pr.id
         JOIN (SELECT pn.persona_id, n.name FROM persona_names_junction pn JOIN names_resource n ON pn.name_id = n.id) pn_name ON pn_name.persona_id = ppj.persona_id
         WHERE pr.id IN (SELECT persona_id FROM all_persona_ids_options)
           AND (persona_search IS NULL OR LOWER(pn_name.name) LIKE '%' || LOWER(persona_search) || '%')),
        '{}'::types.q_list_scenarios_v4_option[]
    ) as persona_options,
    -- Simulation filter options (from simulations_resource directly)
    COALESCE(
        (SELECT ARRAY_AGG(
            (sim_r.id::text, sim_r.name, (SELECT COUNT(*) FROM scenario_data sd WHERE sd.parent_scenario_id IS NULL AND sim_r.id::text = ANY(sd.simulation_ids)))::types.q_list_scenarios_v4_option
            ORDER BY sim_r.name
         )
         FROM simulations_resource sim_r
         WHERE sim_r.id::text IN (SELECT simulation_id FROM all_simulation_ids_options)
           AND (simulation_search IS NULL OR LOWER(sim_r.name) LIKE '%' || LOWER(simulation_search) || '%')),
        '{}'::types.q_list_scenarios_v4_option[]
    ) as simulation_options,
    -- Department filter options (from departments_resource directly)
    COALESCE(
        (SELECT ARRAY_AGG(
            (dr.id::text, dr.name, (SELECT COUNT(*) FROM scenario_data sd WHERE sd.parent_scenario_id IS NULL AND dr.id::text = ANY(sd.department_ids)))::types.q_list_scenarios_v4_option
            ORDER BY dr.name
         )
         FROM departments_resource dr
         WHERE dr.id IN (SELECT department_id FROM user_departments)
           AND dr.id::text IN (SELECT department_id FROM all_department_ids_options)
           AND (department_search IS NULL OR LOWER(dr.name) LIKE '%' || LOWER(department_search) || '%')),
        '{}'::types.q_list_scenarios_v4_option[]
    ) as department_options,
    (SELECT total FROM filtered_count) as total_count
FROM page_scenarios sd
CROSS JOIN user_profile up
GROUP BY up.actor_name, up.role
$$;
