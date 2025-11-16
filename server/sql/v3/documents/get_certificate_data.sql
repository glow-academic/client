-- Get certificate data for a profile
-- Returns profile name and cohort data with simulation scores
-- Params: $1 = profile_id
WITH profile_info AS (
    SELECT 
        id,
        first_name || ' ' || last_name AS profile_name
    FROM profiles
    WHERE id = $1
),
-- Get all cohorts the profile belongs to
profile_cohorts AS (
    SELECT DISTINCT
        c.id AS cohort_id,
        c.title AS cohort_title
    FROM cohort_profiles cp
    JOIN cohorts c ON c.id = cp.cohort_id
    WHERE cp.profile_id = $1
      AND cp.active = TRUE
      AND c.active = TRUE
),
-- Get all simulations for each cohort
cohort_sims AS (
    SELECT DISTINCT
        pc.cohort_id,
        pc.cohort_title,
        s.id AS simulation_id,
        s.title AS simulation_title,
        s.rubric_id
    FROM profile_cohorts pc
    JOIN cohort_simulations cs ON cs.cohort_id = pc.cohort_id
    JOIN simulations s ON s.id = cs.simulation_id
    WHERE cs.active = TRUE
      AND s.active = TRUE
      AND s.practice_simulation = FALSE
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
    FROM analytics a
    WHERE a.profile_id = $1
      AND a.simulation_id IN (SELECT simulation_id FROM cohort_sims)
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
            (SELECT ROUND(100.0 * r.pass_points::numeric / NULLIF(r.points,0))
             FROM simulations s JOIN rubrics r ON r.id = s.rubric_id
             WHERE s.id = aa.simulation_id), 70
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
        COALESCE(ROUND(uss.avg_pct_over_expected::numeric, 2), 0) AS score,
        COALESCE(uss.passed, FALSE) AS passed
    FROM cohort_sims cs
    LEFT JOIN user_sim_status uss ON uss.simulation_id = cs.simulation_id AND uss.profile_id = $1
),
-- Group simulations by cohort and calculate cohort-level passed status
cohort_simulation_data AS (
    SELECT 
        cohort_id,
        cohort_title,
        json_agg(
            json_build_object(
                'name', simulation_title,
                'score', score,
                'passed', passed
            )
            ORDER BY simulation_title
        ) AS simulations,
        BOOL_AND(passed) AS cohort_passed
    FROM simulation_results
    GROUP BY cohort_id, cohort_title
),
-- Final cohort data
cohort_data AS (
    SELECT 
        cohort_title AS name,
        cohort_passed AS passed,
        simulations
    FROM cohort_simulation_data
)
-- Final result
SELECT 
    pi.profile_name,
    COALESCE(
        (SELECT json_agg(
            json_build_object(
                'name', cd.name,
                'passed', cd.passed,
                'simulations', cd.simulations
            )
            ORDER BY cd.name
        )
        FROM cohort_data cd),
        '[]'::json
    ) AS cohort_data
FROM profile_info pi;

