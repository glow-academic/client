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
            (SELECT n.name FROM profile_names_junction pn JOIN names_resource n ON pn.name_id = n.id WHERE pn.profile_id = p.id LIMIT 1),
            (SELECT n.name FROM profile_names_junction pn JOIN names_resource n ON pn.name_id = n.id WHERE pn.profile_id = p.id LIMIT 1),
            'Unknown'
        ) AS profile_name
    FROM params x
    JOIN profile_artifact p ON p.id = x.profile_id
),
-- Get all cohorts the profile belongs to
profile_cohorts_junction AS (
    SELECT DISTINCT
        c.id AS cohort_id,
        (SELECT n.name FROM cohort_names_junction cn JOIN names_resource n ON cn.name_id = n.id WHERE cn.cohort_id = c.id LIMIT 1) AS cohort_title
    FROM params x
    JOIN profile_cohorts_junction cp ON cp.profile_id = x.profile_id
    JOIN cohort_artifact c ON c.id = cp.cohort_id
    WHERE cp.active = TRUE
      AND EXISTS (
        SELECT 1 FROM cohort_flags_junction cf
        JOIN flags_resource f ON cf.flag_id = f.id
        WHERE cf.cohort_id = c.id
          AND f.name = 'cohort_active'
          AND cf.value = TRUE
      )
),
-- Get all simulations for each cohort
cohort_sims AS (
    SELECT DISTINCT
        pc.cohort_id,
        pc.cohort_title,
        s.id AS simulation_id,
        (SELECT n.name FROM simulation_names_junction sn JOIN names_resource n ON sn.name_id = n.id WHERE sn.simulation_id = s.id LIMIT 1) AS simulation_title,
        (SELECT srr.rubric_id FROM simulation_scenarios_junction ss 
         JOIN simulation_scenario_rubrics_junction ssr ON ssr.simulation_id = ss.simulation_id
         JOIN scenario_rubrics_resource srr ON srr.id = ssr.scenario_rubric_id AND srr.scenario_id = ss.scenario_id
         WHERE ss.simulation_id = s.id 
           AND EXISTS (SELECT 1 FROM simulation_scenario_flags_junction ssf JOIN scenario_flags_resource sfr ON ssf.scenario_flag_id = sfr.id JOIN flags_resource f ON sfr.flag_id = f.id WHERE ssf.simulation_id = ss.simulation_id AND sfr.scenario_id = ss.scenario_id AND f.name = 'scenario_active' AND ssf.value = true)
         ORDER BY (SELECT spr.value FROM simulation_scenario_positions_junction ssp JOIN scenario_positions_resource spr ON spr.id = ssp.scenario_position_id WHERE ssp.simulation_id = ss.simulation_id AND spr.scenario_id = ss.scenario_id LIMIT 1)
         LIMIT 1) as rubric_id
    FROM profile_cohorts_junction pc
    JOIN cohort_simulations_junction cs ON cs.cohort_id = pc.cohort_id
    JOIN simulation_artifact s ON s.id = cs.simulation_id
    WHERE cs.active = TRUE
      AND EXISTS (
        SELECT 1 FROM simulation_flags_junction sf
        JOIN flags_resource f ON sf.flag_id = f.id
        WHERE sf.simulation_id = s.id
          AND f.name = 'simulation_active'
          AND sf.value = TRUE
      )
      AND NOT EXISTS (
        SELECT 1 FROM simulation_flags_junction sf
        JOIN flags_resource f ON sf.flag_id = f.id
        WHERE sf.simulation_id = s.id
          AND f.name = 'practice'
          AND sf.value = TRUE
      )
),
-- Get expected scenarios per simulation
sim_expected AS (
    SELECT 
        cs.simulation_id,
        COALESCE(COUNT(*), 0) AS expected_scenarios
    FROM cohort_sims cs
    LEFT JOIN simulation_scenarios_junction ss ON ss.simulation_id = cs.simulation_id
    GROUP BY cs.simulation_id
),
-- Get attempt data from mv_chat_facts (non-practice analytics)
-- Filter for this profile's attempts
filt AS (
    SELECT a.*
    FROM params x
    JOIN mv_chat_facts a ON a.profile_id = x.profile_id
    WHERE a.simulation_id IN (SELECT simulation_id FROM cohort_sims)
      AND a.is_archived = FALSE
      AND a.attempt_type = 'general'
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
            (SELECT ROUND(100.0 * (SELECT p.value FROM rubric_points_junction rp JOIN points_resource p ON rp.point_id = p.id WHERE rp.rubric_id = srr_rubric.rubric_id AND rp.type = 'pass'::point_type LIMIT 1)::numeric / NULLIF((SELECT p.value FROM rubric_points_junction rp JOIN points_resource p ON rp.point_id = p.id WHERE rp.rubric_id = srr_rubric.rubric_id AND rp.type = 'total'::point_type LIMIT 1),0))
             FROM simulation_artifact s
             LEFT JOIN simulation_scenarios_junction ss_rubric ON ss_rubric.simulation_id = s.id 
               AND EXISTS (SELECT 1 FROM simulation_scenario_flags_junction ssf JOIN scenario_flags_resource sfr ON ssf.scenario_flag_id = sfr.id JOIN flags_resource f ON sfr.flag_id = f.id WHERE ssf.simulation_id = ss_rubric.simulation_id AND sfr.scenario_id = ss_rubric.scenario_id AND f.name = 'scenario_active' AND ssf.value = true)
             LEFT JOIN simulation_scenario_rubrics_junction ssr_rubric ON ssr_rubric.simulation_id = ss_rubric.simulation_id
             LEFT JOIN scenario_rubrics_resource srr_rubric ON srr_rubric.id = ssr_rubric.scenario_rubric_id AND srr_rubric.scenario_id = ss_rubric.scenario_id
             WHERE s.id = aa.simulation_id
             ORDER BY (SELECT spr.value FROM simulation_scenario_positions_junction ssp JOIN scenario_positions_resource spr ON spr.id = ssp.scenario_position_id WHERE ssp.simulation_id = ss_rubric.simulation_id AND spr.scenario_id = ss_rubric.scenario_id LIMIT 1)
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
