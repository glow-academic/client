-- Get certificate data for a profile
-- Converted to function pattern with composite types
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
        WHERE proname = 'api_get_certificate_data_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_certificate_data_v4(%s)', r.sig);
    END LOOP;
END $$;

-- 2) Drop types WITH CASCADE (needed for nested composite types)
-- Drop all types matching prefix pattern to handle type additions/removals
-- CASCADE is needed because outer types contain arrays of inner types
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT typname 
        FROM pg_type 
        WHERE typname LIKE 'q_get_certificate_data_v4_%'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I CASCADE', r.typname);
    END LOOP;
END $$;

-- 3) Recreate types
CREATE TYPE types.q_get_certificate_data_v4_simulation AS (
    name text,
    score int,
    passed boolean
);

CREATE TYPE types.q_get_certificate_data_v4_cohort AS (
    name text,
    passed boolean,
    simulations types.q_get_certificate_data_v4_simulation[]
);

-- 4) Recreate function
CREATE OR REPLACE FUNCTION api_get_certificate_data_v4(
    profile_id uuid
)
RETURNS TABLE (
    profile_name text,
    actor_name text,
    cohorts types.q_get_certificate_data_v4_cohort[]
)
LANGUAGE sql
STABLE
AS $$
WITH params AS (
    SELECT profile_id AS profile_id
),
profile_info AS (
    SELECT 
        p.id,
        COALESCE(
            (SELECT n.name FROM profile_names pn JOIN names_resource n ON pn.name_id = n.id WHERE pn.profile_id = p.id AND pn.type = 'full'::type_profile_names LIMIT 1),
            (SELECT n1.name || ' ' || n2.name FROM profile_names pn1 JOIN names_resource n1 ON pn1.name_id = n1.id JOIN profile_names pn2 ON pn2.profile_id = pn1.profile_id JOIN names_resource n2 ON pn2.name_id = n2.id WHERE pn1.profile_id = p.id AND pn1.type = 'first'::type_profile_names AND pn2.type = 'last'::type_profile_names LIMIT 1),
            'Unknown'
        ) AS profile_name
    FROM params x
    JOIN profile_artifact p ON p.id = x.profile_id
),
-- Get all cohorts the profile belongs to
profile_cohorts AS (
    SELECT DISTINCT
        c.id AS cohort_id,
        (SELECT n.name FROM cohort_names cn JOIN names_resource n ON cn.name_id = n.id WHERE cn.cohort_id = c.id LIMIT 1) AS cohort_title
    FROM params x
    JOIN cohort_profiles cp ON cp.profile_id = x.profile_id
    JOIN cohort_artifact c ON c.id = cp.cohort_id
    WHERE cp.active = TRUE
      AND EXISTS (
        SELECT 1 FROM cohort_flags cf
        JOIN flags_resource f ON cf.flag_id = f.id
        WHERE cf.cohort_id = c.id
          AND (SELECT n.name FROM field_names fn JOIN names_resource n ON fn.name_id = n.id WHERE fn.field_id = f.id LIMIT 1) = 'active'
          AND cf.type = 'active'::type_cohort_flags
          AND cf.value = TRUE
      )
),
-- Get all simulations for each cohort
cohort_sims AS (
    SELECT DISTINCT
        pc.cohort_id,
        pc.cohort_title,
        s.id AS simulation_id,
        (SELECT n.name FROM simulation_names sn JOIN names_resource n ON sn.name_id = n.id WHERE sn.simulation_id = s.id LIMIT 1) AS simulation_title,
        (SELECT rga.rubric_id FROM simulation_scenarios ss 
         JOIN simulation_scenarios_scenario_rubric_grade_agents sssrga ON sssrga.simulation_id = ss.simulation_id AND sssrga.scenario_id = ss.scenario_id
         JOIN scenario_rubric_grade_agents_resource srga ON srga.id = sssrga.scenario_rubric_grade_agent_id
         JOIN rubric_grade_agents rga ON rga.id = srga.grade_agent_id
         WHERE ss.simulation_id = s.id 
           AND EXISTS (SELECT 1 FROM simulation_scenario_flags ssf WHERE ssf.simulation_id = ss.simulation_id AND ssf.scenario_id = ss.scenario_id AND ssf.type = 'active'::type_simulation_scenario_flags AND ssf.value = true)
         ORDER BY (SELECT sp.value FROM scenario_positions_resource sp WHERE sp.simulation_id = ss.simulation_id AND sp.scenario_id = ss.scenario_id LIMIT 1)
         LIMIT 1) as rubric_id
    FROM profile_cohorts pc
    JOIN cohort_simulations cs ON cs.cohort_id = pc.cohort_id
    JOIN simulation_artifact s ON s.id = cs.simulation_id
    WHERE cs.active = TRUE
      AND EXISTS (
        SELECT 1 FROM simulation_flags sf
        JOIN flags_resource f ON sf.flag_id = f.id
        WHERE sf.simulation_id = s.id
          AND (SELECT n.name FROM field_names fn JOIN names_resource n ON fn.name_id = n.id WHERE fn.field_id = f.id LIMIT 1) = 'active'
          AND sf.type = 'active'::type_simulation_flags
          AND sf.value = TRUE
      )
      AND NOT EXISTS (
        SELECT 1 FROM simulation_flags sf
        JOIN flags_resource f ON sf.flag_id = f.id
        WHERE sf.simulation_id = s.id
          AND (SELECT n.name FROM field_names fn JOIN names_resource n ON fn.name_id = n.id WHERE fn.field_id = f.id LIMIT 1) = 'practice'
          AND sf.type = 'practice'::type_simulation_flags
          AND sf.value = TRUE
      )
),
-- Get expected scenarios per simulation
sim_expected AS (
    SELECT 
        cs.simulation_id,
        COALESCE(COUNT(*), 0) AS expected_scenarios
    FROM cohort_sims cs
    LEFT JOIN simulation_scenarios ss ON ss.simulation_id = cs.simulation_id
    GROUP BY cs.simulation_id
),
-- Get attempt data from analytics (using same pattern as home_overview.sql)
-- Filter analytics for this profile's attempts
filt AS (
    SELECT a.* 
    FROM params x
    JOIN analytics a ON a.profile_id = x.profile_id
    WHERE a.simulation_id IN (SELECT simulation_id FROM cohort_sims)
      AND a.is_practice = FALSE
      AND a.is_archived = FALSE
),
-- Per attempt: sum grade_percent over completed root scenarios
attempt_scores AS (
    SELECT
        ap.attempt_id,
        ap.profile_id,
        ap.simulation_id,
        COALESCE(SUM(ap.grade_percent) FILTER (WHERE ap.completed AND ap.grade_percent IS NOT NULL), 0)::numeric AS sum_completed_pct,
        se.expected_scenarios
    FROM filt ap
    JOIN sim_expected se ON se.simulation_id = ap.simulation_id
    GROUP BY ap.attempt_id, ap.profile_id, ap.simulation_id, se.expected_scenarios
),
-- Average over expected scenarios (missing = 0)
attempt_avg AS (
    SELECT
        attempt_id,
        profile_id,
        simulation_id,
        CASE WHEN expected_scenarios > 0
             THEN (sum_completed_pct / expected_scenarios)
             ELSE 0 END AS avg_pct_over_expected
    FROM attempt_scores
),
-- User-simulation status with best attempt + pass status
user_sim_status AS (
    SELECT
        aa.profile_id,
        aa.simulation_id,
        MAX(aa.avg_pct_over_expected) AS avg_pct_over_expected,
        BOOL_OR(aa.avg_pct_over_expected >= COALESCE(
            (SELECT ROUND(100.0 * (SELECT p.value FROM rubric_points rp JOIN points_resource p ON rp.point_id = p.id WHERE rp.rubric_id = rga_rubric.rubric_id AND rp.type = 'pass'::type_rubric_points LIMIT 1)::numeric / NULLIF((SELECT p.value FROM rubric_points rp JOIN points_resource p ON rp.point_id = p.id WHERE rp.rubric_id = rga_rubric.rubric_id AND rp.type = 'total'::type_rubric_points LIMIT 1),0))
             FROM simulation_artifact s
             LEFT JOIN simulation_scenarios ss_rubric ON ss_rubric.simulation_id = s.id 
               AND EXISTS (SELECT 1 FROM simulation_scenario_flags ssf WHERE ssf.simulation_id = ss_rubric.simulation_id AND ssf.scenario_id = ss_rubric.scenario_id AND ssf.type = 'active'::type_simulation_scenario_flags AND ssf.value = true)
             LEFT JOIN simulation_scenarios_scenario_rubric_grade_agents sssrga_rubric ON sssrga_rubric.simulation_id = ss_rubric.simulation_id AND sssrga_rubric.scenario_id = ss_rubric.scenario_id
             LEFT JOIN scenario_rubric_grade_agents_resource srga_rubric ON srga_rubric.id = sssrga_rubric.scenario_rubric_grade_agent_id
             LEFT JOIN rubric_grade_agents rga_rubric ON rga_rubric.id = srga_rubric.grade_agent_id
             WHERE s.id = aa.simulation_id
             ORDER BY (SELECT sp.value FROM scenario_positions_resource sp WHERE sp.simulation_id = ss_rubric.simulation_id AND sp.scenario_id = ss_rubric.scenario_id LIMIT 1)
             LIMIT 1), 70
        )) AS passed
    FROM attempt_avg aa
    GROUP BY aa.profile_id, aa.simulation_id
),
-- Combine simulation data with scores and pass status
simulation_results AS (
    SELECT 
        cs.cohort_id,
        cs.cohort_title,
        cs.simulation_id,
        cs.simulation_title,
        COALESCE(ROUND(uss.avg_pct_over_expected::numeric)::int, 0) AS score,
        COALESCE(uss.passed, FALSE) AS passed
    FROM cohort_sims cs
    LEFT JOIN user_sim_status uss ON uss.simulation_id = cs.simulation_id AND uss.profile_id = (SELECT profile_id FROM params)
),
-- Group simulations by cohort using composite types
cohort_simulation_data AS (
    SELECT 
        cohort_id,
        cohort_title,
        COALESCE(
            ARRAY_AGG(
                (sr.simulation_title, sr.score, sr.passed)::types.q_get_certificate_data_v4_simulation
                ORDER BY sr.simulation_title
            ),
            '{}'::types.q_get_certificate_data_v4_simulation[]
        ) AS simulations,
        BOOL_AND(sr.passed) AS cohort_passed
    FROM simulation_results sr
    GROUP BY cohort_id, cohort_title
),
-- Final cohort data with nested composite types
cohort_data AS (
    SELECT 
        cohort_title AS name,
        cohort_passed AS passed,
        simulations
    FROM cohort_simulation_data
)
-- Final result
SELECT 
    pi.profile_name::text as profile_name,
    pi.profile_name::text as actor_name,
    COALESCE(
        (SELECT ARRAY_AGG(
            (cd.name, cd.passed, cd.simulations)::types.q_get_certificate_data_v4_cohort
            ORDER BY cd.name
        )
        FROM cohort_data cd),
        '{}'::types.q_get_certificate_data_v4_cohort[]
    ) AS cohorts
FROM profile_info pi
LIMIT 1
$$;