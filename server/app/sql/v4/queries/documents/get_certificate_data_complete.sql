-- Get certificate data for a profile
-- Returns flat cohort/simulation structure - scoring computed in Python via attempt view internals
-- Uses safe drop/recreate pattern: drop function first, then recreate
-- 1) Drop function first (breaks dependency on types)
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

-- 2) Drop old composite types (no longer needed - scoring moved to Python)
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

-- 3) Recreate function (no composite types needed)
CREATE OR REPLACE FUNCTION api_get_certificate_data_v4(
    profile_id uuid
)
RETURNS TABLE (
    profile_name text,
    cohort_id uuid,
    cohort_name text,
    simulation_id uuid,
    simulation_name text,
    expected_scenarios bigint,
    pass_threshold_percent numeric
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
            'Unknown'
        ) AS profile_name
    FROM params x
    JOIN profile_artifact p ON p.id = x.profile_id
),
-- Get all cohorts the profile belongs to
profile_active_cohorts AS (
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
    FROM profile_active_cohorts pc
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
-- Get pass threshold from rubric (default 70%)
sim_pass_threshold AS (
    SELECT DISTINCT
        cs.simulation_id,
        CASE
            WHEN cs.rubric_id IS NOT NULL THEN
                COALESCE(
                    ROUND(100.0 *
                        (SELECT pr.value FROM rubric_points_junction rp JOIN points_resource pr ON rp.point_id = pr.id WHERE rp.rubric_id = cs.rubric_id AND rp.type = 'pass'::point_type LIMIT 1)::numeric /
                        NULLIF((SELECT pr.value FROM rubric_points_junction rp JOIN points_resource pr ON rp.point_id = pr.id WHERE rp.rubric_id = cs.rubric_id AND rp.type = 'total'::point_type LIMIT 1), 0)
                    ),
                    70
                )
            ELSE 70
        END AS pass_threshold_percent
    FROM cohort_sims cs
)
SELECT
    (SELECT profile_name FROM profile_info)::text as profile_name,
    cs.cohort_id,
    cs.cohort_title::text as cohort_name,
    cs.simulation_id,
    cs.simulation_title::text as simulation_name,
    COALESCE(se.expected_scenarios, 0)::bigint as expected_scenarios,
    COALESCE(spt.pass_threshold_percent, 70)::numeric as pass_threshold_percent
FROM cohort_sims cs
LEFT JOIN sim_expected se ON se.simulation_id = cs.simulation_id
LEFT JOIN sim_pass_threshold spt ON spt.simulation_id = cs.simulation_id
$$;
