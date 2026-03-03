-- Export simulations with full resource IDs and values for round-trip CSV
-- 1) Drop function first
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_export_simulations_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_export_simulations_v4(%s)', r.sig);
    END LOOP;
END $$;

-- 2) Drop types
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT typname
        FROM pg_type
        WHERE typname LIKE 'q_export_simulations_v4_%'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I', r.typname);
    END LOOP;
END $$;

-- 3) Recreate types
CREATE TYPE types.q_export_simulations_v4_row AS (
    simulation_id uuid,
    -- Single-select: ID + value
    name_id uuid,
    name text,
    description_id uuid,
    description text,
    -- Flags
    is_inactive boolean,
    is_practice boolean,
    -- Multi-select: ID arrays + value arrays
    department_ids uuid[],
    departments text[],
    scenario_ids uuid[],
    scenarios text[],
    scenario_flag_ids uuid[],
    scenario_flags text[],
    scenario_position_ids uuid[],
    scenario_positions text[],
    scenario_rubric_ids uuid[],
    scenario_rubrics text[],
    scenario_time_limit_ids uuid[],
    scenario_time_limits text[]
);

-- 4) Recreate function
CREATE OR REPLACE FUNCTION api_export_simulations_v4(
    profile_id uuid,
    search text DEFAULT NULL,
    filter_scenario_ids uuid[] DEFAULT NULL,
    filter_cohort_ids uuid[] DEFAULT NULL,
    filter_department_ids uuid[] DEFAULT NULL
)
RETURNS TABLE (
    rows types.q_export_simulations_v4_row[]
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
-- Scenarios per simulation via denormalized simulations_resource.scenario_ids
simulation_scenarios_data AS (
    SELECT
        ssj.simulation_id,
        ARRAY_AGG(sr.id ORDER BY sr.name) as scenario_ids,
        ARRAY_AGG(sr.name ORDER BY sr.name) as scenario_names
    FROM simulation_simulations_junction ssj
    JOIN simulations_resource sim_r ON sim_r.id = ssj.simulations_id
    JOIN LATERAL unnest(sim_r.scenario_ids) AS scen_id ON true
    JOIN scenarios_resource sr ON sr.id = scen_id
    GROUP BY ssj.simulation_id
),
-- Department data
simulation_departments_data AS (
    SELECT
        sd.simulation_id,
        ARRAY_AGG(sd.department_id ORDER BY sd.created_at) as department_ids,
        ARRAY_AGG(dr.name ORDER BY sd.created_at) as department_names
    FROM simulation_departments_junction sd
    JOIN departments_resource dr ON dr.id = sd.department_id
    WHERE sd.active = true
    GROUP BY sd.simulation_id
),
-- Scenario flags data (flag_id -> flags_resource.name via scenario_flags_resource.flag_id)
simulation_scenario_flags_data AS (
    SELECT
        ssfj.simulation_id,
        ARRAY_AGG(ssfj.scenario_flag_id ORDER BY ssfj.created_at) as flag_ids,
        ARRAY_AGG(fr.name ORDER BY ssfj.created_at) as flag_names
    FROM simulation_scenario_flags_junction ssfj
    JOIN scenario_flags_resource sfr ON sfr.id = ssfj.scenario_flag_id
    JOIN flags_resource fr ON fr.id = sfr.flag_id
    WHERE ssfj.active = true
    GROUP BY ssfj.simulation_id
),
-- Scenario positions data (value is an integer)
simulation_scenario_positions_data AS (
    SELECT
        sspj.simulation_id,
        ARRAY_AGG(sspj.scenario_position_id ORDER BY spr.value) as position_ids,
        ARRAY_AGG(spr.value::text ORDER BY spr.value) as position_values
    FROM simulation_scenario_positions_junction sspj
    JOIN scenario_positions_resource spr ON spr.id = sspj.scenario_position_id
    WHERE sspj.active = true
    GROUP BY sspj.simulation_id
),
-- Scenario rubrics data (rubric_id -> rubrics_resource.name)
simulation_scenario_rubrics_data AS (
    SELECT
        ssrj.simulation_id,
        ARRAY_AGG(ssrj.scenario_rubric_id ORDER BY ssrj.created_at) as rubric_ids,
        ARRAY_AGG(rr.name ORDER BY ssrj.created_at) as rubric_names
    FROM simulation_scenario_rubrics_junction ssrj
    JOIN scenario_rubrics_resource srr ON srr.id = ssrj.scenario_rubric_id
    JOIN rubrics_resource rr ON rr.id = srr.rubric_id
    WHERE ssrj.active = true
    GROUP BY ssrj.simulation_id
),
-- Scenario time limits data (time_limit_seconds as value)
simulation_scenario_time_limits_data AS (
    SELECT
        sstlj.simulation_id,
        ARRAY_AGG(sstlj.scenario_time_limit_id ORDER BY stlr.time_limit_seconds) as time_limit_ids,
        ARRAY_AGG(stlr.time_limit_seconds::text ORDER BY stlr.time_limit_seconds) as time_limit_values
    FROM simulation_scenario_time_limits_junction sstlj
    JOIN scenario_time_limits_resource stlr ON stlr.id = sstlj.scenario_time_limit_id
    WHERE sstlj.active = true
    GROUP BY sstlj.simulation_id
),
-- Cohort data for filtering (via reverse lookup)
simulation_cohorts_data AS (
    SELECT
        ssj.simulation_id,
        ARRAY_AGG(DISTINCT ccj.cohort_id) as cohort_ids
    FROM simulation_simulations_junction ssj
    JOIN cohorts_resource cr ON ssj.simulations_id = ANY(cr.simulation_ids) AND cr.active = true
    JOIN cohort_cohorts_junction ccj ON ccj.cohorts_id = cr.id
    GROUP BY ssj.simulation_id
),
-- Main simulation data
simulation_data AS (
    SELECT
        s.id as simulation_id,
        -- Name
        (SELECT sn.name_id FROM simulation_names_junction sn WHERE sn.simulation_id = s.id LIMIT 1) as name_id,
        (SELECT n.name FROM simulation_names_junction sn JOIN names_resource n ON sn.name_id = n.id WHERE sn.simulation_id = s.id LIMIT 1) as name,
        -- Description
        (SELECT sd.description_id FROM simulation_descriptions_junction sd WHERE sd.simulation_id = s.id AND sd.active = true LIMIT 1) as description_id,
        (SELECT d.description FROM simulation_descriptions_junction sd JOIN descriptions_resource d ON sd.description_id = d.id WHERE sd.simulation_id = s.id AND sd.active = true LIMIT 1) as description,
        -- Flags
        NOT EXISTS (SELECT 1 FROM simulation_flags_junction sf JOIN flags_resource f ON sf.flag_id = f.id WHERE sf.simulation_id = s.id AND f.type = 'simulation_active' AND sf.value = TRUE) as is_inactive,
        EXISTS (SELECT 1 FROM simulation_flags_junction sf JOIN flags_resource f ON sf.flag_id = f.id WHERE sf.simulation_id = s.id AND f.type = 'practice' AND sf.value = TRUE) as is_practice,
        -- Multi-select
        sdd.department_ids,
        sdd.department_names as departments,
        ssd.scenario_ids,
        ssd.scenario_names as scenarios,
        ssfd.flag_ids as scenario_flag_ids,
        ssfd.flag_names as scenario_flags,
        sspd.position_ids as scenario_position_ids,
        sspd.position_values as scenario_positions,
        ssrd.rubric_ids as scenario_rubric_ids,
        ssrd.rubric_names as scenario_rubrics,
        sstld.time_limit_ids as scenario_time_limit_ids,
        sstld.time_limit_values as scenario_time_limits,
        -- For filtering
        s.updated_at,
        COALESCE(scod.cohort_ids, ARRAY[]::uuid[]) as cohort_ids
    FROM simulation_artifact s
    LEFT JOIN simulation_departments_junction sdj ON sdj.simulation_id = s.id AND sdj.active = true
    LEFT JOIN simulation_departments_data sdd ON sdd.simulation_id = s.id
    LEFT JOIN simulation_scenarios_data ssd ON ssd.simulation_id = s.id
    LEFT JOIN simulation_scenario_flags_data ssfd ON ssfd.simulation_id = s.id
    LEFT JOIN simulation_scenario_positions_data sspd ON sspd.simulation_id = s.id
    LEFT JOIN simulation_scenario_rubrics_data ssrd ON ssrd.simulation_id = s.id
    LEFT JOIN simulation_scenario_time_limits_data sstld ON sstld.simulation_id = s.id
    LEFT JOIN simulation_cohorts_data scod ON scod.simulation_id = s.id
    GROUP BY s.id, s.updated_at,
        sdd.department_ids, sdd.department_names,
        ssd.scenario_ids, ssd.scenario_names,
        ssfd.flag_ids, ssfd.flag_names,
        sspd.position_ids, sspd.position_values,
        ssrd.rubric_ids, ssrd.rubric_names,
        sstld.time_limit_ids, sstld.time_limit_values,
        scod.cohort_ids
    HAVING
        COUNT(sdj.simulation_id) FILTER (WHERE sdj.department_id IN (SELECT department_id FROM user_departments)) > 0
        OR NOT EXISTS (SELECT 1 FROM simulation_departments_junction sd2 WHERE sd2.simulation_id = s.id AND sd2.active = true)
),
-- Apply filters
filtered_simulations AS (
    SELECT sd.*
    FROM simulation_data sd
    WHERE
        (search IS NULL OR LOWER(sd.name) LIKE '%' || LOWER(search) || '%' OR LOWER(sd.description) LIKE '%' || LOWER(search) || '%')
        AND (filter_scenario_ids IS NULL OR sd.scenario_ids::text[] && filter_scenario_ids::text[])
        AND (filter_cohort_ids IS NULL OR sd.cohort_ids::text[] && filter_cohort_ids::text[])
        AND (filter_department_ids IS NULL OR sd.department_ids::text[] && filter_department_ids::text[])
)
SELECT
    COALESCE(
        (SELECT ARRAY_AGG(
            (fs.simulation_id,
             fs.name_id, fs.name,
             fs.description_id, fs.description,
             fs.is_inactive, fs.is_practice,
             fs.department_ids, fs.departments,
             fs.scenario_ids, fs.scenarios,
             fs.scenario_flag_ids, fs.scenario_flags,
             fs.scenario_position_ids, fs.scenario_positions,
             fs.scenario_rubric_ids, fs.scenario_rubrics,
             fs.scenario_time_limit_ids, fs.scenario_time_limits
            )::types.q_export_simulations_v4_row
            ORDER BY fs.updated_at DESC NULLS LAST
        ) FROM filtered_simulations fs),
        '{}'::types.q_export_simulations_v4_row[]
    ) as rows
FROM params
$$;
