-- Get simulations list with permissions and relationships
-- Resource-first: simplified joins, uses resource tables where possible
-- Removed: view_simulation_edit_state, general_agent_for_user, rubric_data, document/parameter types
-- Removed: departments[] mapping, cohorts[] mapping (client doesn't use them)
-- Simplified: scenario type (only id/name/persona_ids/persona_mapping), persona type (only id/color)
-- Uses: cohorts_resource.simulation_ids (reverse lookup), scenarios_resource, personas_resource
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

-- 2) Drop types WITHOUT CASCADE — order matters due to inter-type dependencies
DROP TYPE IF EXISTS types.q_list_simulations_v4_scenario;
DROP TYPE IF EXISTS types.q_list_simulations_v4_persona;
DROP TYPE IF EXISTS types.q_list_simulations_v4_document;
DROP TYPE IF EXISTS types.q_list_simulations_v4_field;
DROP TYPE IF EXISTS types.q_list_simulations_v4_simulation;
DROP TYPE IF EXISTS types.q_list_simulations_v4_rubric;
DROP TYPE IF EXISTS types.q_list_simulations_v4_department;
DROP TYPE IF EXISTS types.q_list_simulations_v4_cohort;
DROP TYPE IF EXISTS types.q_list_simulations_v4_option;

-- 3) Recreate types (scenario/persona mapping types removed — hydrated in Python)
CREATE TYPE types.q_list_simulations_v4_simulation AS (
    simulation_id uuid,
    name text,
    description text,
    department_ids text[],
    active boolean,
    practice_simulation boolean,
    can_edit boolean,
    can_delete boolean,
    can_duplicate boolean,
    scenario_ids uuid[],
    num_cohorts int,
    cohort_ids text[],
    updated_at timestamptz
);

CREATE TYPE types.q_list_simulations_v4_option AS (
    value text,
    label text,
    count bigint
);

-- 4) Recreate function
CREATE OR REPLACE FUNCTION api_list_simulations_v4(
    profile_id uuid,
    search text DEFAULT NULL,
    filter_scenario_ids uuid[] DEFAULT NULL,
    filter_cohort_ids uuid[] DEFAULT NULL,
    filter_department_ids uuid[] DEFAULT NULL,
    scenario_search text DEFAULT NULL,
    cohort_search text DEFAULT NULL,
    department_search text DEFAULT NULL,
    page_size int DEFAULT 12,
    page_offset int DEFAULT 0
)
RETURNS TABLE (
    simulations types.q_list_simulations_v4_simulation[],
    scenario_options types.q_list_simulations_v4_option[],
    cohort_options types.q_list_simulations_v4_option[],
    department_options types.q_list_simulations_v4_option[],
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
-- User context: actor_name comes from get_profile_context_internal() in Python
user_profile AS (
    SELECT COALESCE(r.role, 'member'::profile_type) as role,
           ''::text as actor_name
    FROM profile_roles_junction prj
    JOIN roles_resource r ON prj.role_id = r.id
    WHERE prj.profile_id = (SELECT profile_id FROM params)
    LIMIT 1
),
-- Scenarios per simulation via denormalized simulations_resource.scenario_ids
-- simulation_artifact -> simulation_simulations_junction -> simulations_resource.scenario_ids -> scenarios_resource
simulation_scenarios_data AS (
    SELECT
        ssj.simulation_id,
        ARRAY_AGG(sr.id ORDER BY sr.name) as scenario_ids,
        COUNT(sr.id) as num_scenarios
    FROM simulation_simulations_junction ssj
    JOIN simulations_resource sim_r ON sim_r.id = ssj.simulations_id
    JOIN LATERAL unnest(sim_r.scenario_ids) AS scen_id ON true
    JOIN scenarios_resource sr ON sr.id = scen_id
    GROUP BY ssj.simulation_id
),
-- Attempt counts via simulation_attempts_simulations_connection
attempt_counts AS (
    SELECT
        ssj.simulation_id,
        COUNT(DISTINCT sac.attempt_id) as attempt_count
    FROM simulation_simulations_junction ssj
    JOIN simulation_attempts_simulations_connection sac ON sac.simulations_id = ssj.simulations_id
    GROUP BY ssj.simulation_id
),
-- Cohort data via cohorts_resource.simulation_ids (reverse lookup, replaces view_simulation_edit_state + cohort_simulations_junction)
simulation_cohorts_data AS (
    SELECT
        ssj.simulation_id,
        ARRAY_AGG(DISTINCT ccj.cohort_id::text) as cohort_ids,
        COUNT(DISTINCT ccj.cohort_id)::int as num_cohorts,
        COUNT(DISTINCT ccj.cohort_id)::int as total_cohort_links
    FROM simulation_simulations_junction ssj
    JOIN cohorts_resource cr ON ssj.simulations_id = ANY(cr.simulation_ids) AND cr.active = true
    JOIN cohort_cohorts_junction ccj ON ccj.cohorts_id = cr.id
    GROUP BY ssj.simulation_id
),
-- Department IDs per simulation (simulation's own junction)
simulation_departments_data AS (
    SELECT
        sd.simulation_id,
        ARRAY_AGG(sd.department_id::text ORDER BY sd.created_at) as department_ids
    FROM simulation_departments_junction sd
    WHERE sd.active = true
    GROUP BY sd.simulation_id
),
-- Main simulation data with permissions computed in SQL
simulation_data AS (
    SELECT
        s.id as simulation_id,
        (SELECT n.name FROM simulation_names_junction sn JOIN names_resource n ON sn.name_id = n.id WHERE sn.simulation_id = s.id LIMIT 1) as name,
        COALESCE(
            NULLIF(
                REGEXP_REPLACE(
                    TRIM((SELECT d.description FROM simulation_descriptions_junction sd JOIN descriptions_resource d ON sd.description_id = d.id WHERE sd.simulation_id = s.id AND sd.active = true LIMIT 1)),
                    '^0$|\\s0$',
                    ''
                ),
                ''
            ),
            'No description'
        ) as description,
        EXISTS (SELECT 1 FROM simulation_flags_junction sf JOIN flags_resource f ON sf.flag_id = f.id WHERE sf.simulation_id = s.id AND f.name = 'simulation_active' AND sf.value = TRUE) as active,
        EXISTS (SELECT 1 FROM simulation_flags_junction sf JOIN flags_resource f ON sf.flag_id = f.id WHERE sf.simulation_id = s.id AND f.name = 'practice' AND sf.value = TRUE) as practice_simulation,
        s.updated_at,
        COALESCE(sdd.department_ids, NULL) as department_ids,
        COALESCE(ssd.scenario_ids, ARRAY[]::uuid[]) as scenario_ids,
        COALESCE(ac.attempt_count, 0) as attempt_count,
        COALESCE(scd.total_cohort_links, 0) as total_cohort_links,
        COALESCE(scd.num_cohorts, 0) as num_cohorts,
        COALESCE(scd.cohort_ids, ARRAY[]::text[]) as cohort_ids,
        -- Permissions computed in SQL
        CASE
            WHEN sdd.department_ids IS NULL AND up.role != 'superadmin' THEN false
            WHEN up.role IN ('admin'::profile_type, 'instructional'::profile_type, 'superadmin'::profile_type) THEN true
            ELSE false
        END as can_edit,
        CASE
            WHEN sdd.department_ids IS NULL AND up.role != 'superadmin' THEN false
            WHEN COALESCE(scd.total_cohort_links, 0) > 0 THEN false
            WHEN up.role IN ('admin'::profile_type, 'instructional'::profile_type, 'superadmin'::profile_type) THEN true
            ELSE false
        END as can_delete,
        CASE
            WHEN up.role IN ('admin'::profile_type, 'instructional'::profile_type, 'superadmin'::profile_type) THEN true
            ELSE false
        END as can_duplicate
    FROM simulation_artifact s
    LEFT JOIN simulation_departments_junction sd ON sd.simulation_id = s.id AND sd.active = true
    LEFT JOIN simulation_departments_data sdd ON sdd.simulation_id = s.id
    LEFT JOIN simulation_scenarios_data ssd ON ssd.simulation_id = s.id
    LEFT JOIN attempt_counts ac ON ac.simulation_id = s.id
    LEFT JOIN simulation_cohorts_data scd ON scd.simulation_id = s.id
    CROSS JOIN user_profile up
    GROUP BY s.id,
        (SELECT n.name FROM simulation_names_junction sn JOIN names_resource n ON sn.name_id = n.id WHERE sn.simulation_id = s.id LIMIT 1),
        (SELECT d.description FROM simulation_descriptions_junction sd JOIN descriptions_resource d ON sd.description_id = d.id WHERE sd.simulation_id = s.id AND sd.active = true LIMIT 1),
        EXISTS (SELECT 1 FROM simulation_flags_junction sf JOIN flags_resource f ON sf.flag_id = f.id WHERE sf.simulation_id = s.id AND f.name = 'simulation_active' AND sf.value = TRUE),
        EXISTS (SELECT 1 FROM simulation_flags_junction sf JOIN flags_resource f ON sf.flag_id = f.id WHERE sf.simulation_id = s.id AND f.name = 'practice' AND sf.value = TRUE),
        s.updated_at, sdd.department_ids, ssd.scenario_ids,
        ac.attempt_count, scd.total_cohort_links, scd.num_cohorts, scd.cohort_ids, up.role
    HAVING
        COUNT(sd.simulation_id) FILTER (WHERE sd.department_id IN (SELECT department_id FROM user_departments)) > 0
        OR NOT EXISTS (SELECT 1 FROM simulation_departments_junction sd2 WHERE sd2.simulation_id = s.id AND sd2.active = true)
),
-- Server-side filtering
filtered_simulations AS (
    SELECT sd.*
    FROM simulation_data sd
    WHERE (search IS NULL OR LOWER(sd.name) LIKE '%' || LOWER(search) || '%' OR LOWER(sd.description) LIKE '%' || LOWER(search) || '%')
      AND (filter_scenario_ids IS NULL OR sd.scenario_ids && filter_scenario_ids)
      AND (filter_cohort_ids IS NULL OR sd.cohort_ids && filter_cohort_ids::text[])
      AND (filter_department_ids IS NULL OR sd.department_ids && filter_department_ids::text[])
),
filtered_count AS (
    SELECT COUNT(*)::bigint as total FROM filtered_simulations
),
paginated_simulations AS (
    SELECT * FROM filtered_simulations
    ORDER BY updated_at DESC NULLS LAST
    LIMIT page_size OFFSET page_offset
),
-- Scenario/persona mapping removed — hydrated in Python via cached *_internal() functions
-- Options derived from ALL simulation_data (unfiltered) for filter dropdowns
all_scenario_ids_options AS (
    SELECT DISTINCT unnest(scenario_ids) as scenario_id
    FROM simulation_data
),
all_cohort_ids_options AS (
    SELECT DISTINCT unnest(cohort_ids) as cohort_id
    FROM simulation_data
    WHERE cohort_ids IS NOT NULL AND cohort_ids != ARRAY[]::text[]
),
all_department_ids_options AS (
    SELECT DISTINCT unnest(department_ids) as department_id
    FROM simulation_data
    WHERE department_ids IS NOT NULL
)
SELECT
    -- Aggregate simulations (from paginated set)
    COALESCE(
        (SELECT ARRAY_AGG(
            (simd.simulation_id, simd.name, simd.description, simd.department_ids,
             simd.active, simd.practice_simulation,
             simd.can_edit, simd.can_delete, simd.can_duplicate,
             simd.scenario_ids, simd.num_cohorts, simd.cohort_ids, simd.updated_at
            )::types.q_list_simulations_v4_simulation
            ORDER BY simd.updated_at DESC NULLS LAST
        ) FROM paginated_simulations simd),
        '{}'::types.q_list_simulations_v4_simulation[]
    ) as simulations,
    -- Scenario options (from ALL simulations, filtered by search term) — resource-level IDs
    COALESCE(
        (SELECT ARRAY_AGG(
            (sr.id::text, COALESCE(sr.name, ''), (SELECT COUNT(*) FROM simulation_data sd WHERE sr.id = ANY(sd.scenario_ids)))::types.q_list_simulations_v4_option
            ORDER BY sr.name
        )
         FROM scenarios_resource sr
         WHERE sr.id IN (SELECT scenario_id FROM all_scenario_ids_options)
           AND (scenario_search IS NULL OR LOWER(sr.name) LIKE '%' || LOWER(scenario_search) || '%')),
        '{}'::types.q_list_simulations_v4_option[]
    ) as scenario_options,
    -- Cohort options (from ALL simulations, filtered by search term) — artifact-level IDs via cohort_cohorts_junction
    COALESCE(
        (SELECT ARRAY_AGG(
            (ccj.cohort_id::text, COALESCE(cr.name, ''), (SELECT COUNT(*) FROM simulation_data sd WHERE ccj.cohort_id::text = ANY(sd.cohort_ids)))::types.q_list_simulations_v4_option
            ORDER BY cr.name
        )
         FROM all_cohort_ids_options acio
         JOIN cohort_cohorts_junction ccj ON ccj.cohort_id = acio.cohort_id::uuid
         JOIN cohorts_resource cr ON cr.id = ccj.cohorts_id
         WHERE (cohort_search IS NULL OR LOWER(cr.name) LIKE '%' || LOWER(cohort_search) || '%')),
        '{}'::types.q_list_simulations_v4_option[]
    ) as cohort_options,
    -- Department options (from user's departments, filtered by search term)
    COALESCE(
        (SELECT ARRAY_AGG(
            (dr.id::text, COALESCE(dr.name, ''), (SELECT COUNT(*) FROM simulation_data sd WHERE dr.id::text = ANY(sd.department_ids)))::types.q_list_simulations_v4_option
            ORDER BY dr.name
        )
         FROM departments_resource dr
         WHERE dr.id IN (SELECT department_id FROM user_departments)
           AND dr.id::text IN (SELECT department_id FROM all_department_ids_options)
           AND (department_search IS NULL OR LOWER(dr.name) LIKE '%' || LOWER(department_search) || '%')),
        '{}'::types.q_list_simulations_v4_option[]
    ) as department_options,
    (SELECT total FROM filtered_count) as total_count
FROM user_profile up
$$;

