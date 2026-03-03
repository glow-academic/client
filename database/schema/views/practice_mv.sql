-- Materialized View: practice_mv
-- Practice-level denormalized context for the practice training list/cards page.
--
-- Grain: One row per practice_entry.id
-- All resource IDs from practice_*_connection tables.
-- Chat-level resources (scenario_ids) aggregated UP from
-- practice_chat_entry -> chat_entry -> chat_scenarios_connection.

CREATE MATERIALIZED VIEW practice_mv AS
WITH
-- practice_entry level connections
simulation_agg AS (
    SELECT
        psc.practice_id,
        ARRAY_AGG(DISTINCT psc.simulations_id ORDER BY psc.simulations_id) AS simulation_ids
    FROM practice_simulations_connection psc
    WHERE psc.active = true
    GROUP BY psc.practice_id
),
cohort_agg AS (
    SELECT
        pcc.practice_id,
        ARRAY_AGG(DISTINCT pcc.cohorts_id ORDER BY pcc.cohorts_id) AS cohort_ids
    FROM practice_cohorts_connection pcc
    WHERE pcc.active = true
    GROUP BY pcc.practice_id
),
department_agg AS (
    SELECT
        pdc.practice_id,
        ARRAY_AGG(DISTINCT pdc.departments_id ORDER BY pdc.departments_id) AS department_ids
    FROM practice_departments_connection pdc
    WHERE pdc.active = true
    GROUP BY pdc.practice_id
),
profile_agg AS (
    SELECT
        ppc.practice_id,
        ARRAY_AGG(DISTINCT ppc.profiles_id ORDER BY ppc.profiles_id) AS profile_ids
    FROM practice_profiles_connection ppc
    WHERE ppc.active = true
    GROUP BY ppc.practice_id
),
-- Chat level connections (aggregated UP to practice_entry via practice_chat_entry)
chat_agg AS (
    SELECT
        pte.practice_id,
        ARRAY_AGG(DISTINCT pte.chat_id ORDER BY pte.chat_id) AS chat_ids
    FROM practice_chat_entry pte
    WHERE pte.active = true
    GROUP BY pte.practice_id
),
scenario_agg AS (
    SELECT
        pte.practice_id,
        ARRAY_AGG(DISTINCT tsc.scenarios_id ORDER BY tsc.scenarios_id) AS scenario_ids
    FROM practice_chat_entry pte
    JOIN chat_scenarios_connection tsc
      ON tsc.chat_id = pte.chat_id AND tsc.active = true
    WHERE pte.active = true
    GROUP BY pte.practice_id
),
rubric_agg AS (
    SELECT
        pte.practice_id,
        ARRAY_AGG(DISTINCT crc.rubrics_id ORDER BY crc.rubrics_id) AS rubric_ids
    FROM practice_chat_entry pte
    JOIN chat_rubrics_connection crc
      ON crc.chat_id = pte.chat_id AND crc.active = true
    WHERE pte.active = true
    GROUP BY pte.practice_id
),
scenario_time_limit_agg AS (
    SELECT
        pte.practice_id,
        ARRAY_AGG(DISTINCT cstlc.scenario_time_limits_id ORDER BY cstlc.scenario_time_limits_id) AS scenario_time_limit_ids
    FROM practice_chat_entry pte
    JOIN chat_scenario_time_limits_connection cstlc
      ON cstlc.chat_id = pte.chat_id AND cstlc.active = true
    WHERE pte.active = true
    GROUP BY pte.practice_id
)
SELECT
    pe.id AS practice_id,

    -- practice_entry level connections
    COALESCE(sim.simulation_ids, ARRAY[]::uuid[]) AS simulation_ids,
    COALESCE(coh.cohort_ids, ARRAY[]::uuid[]) AS cohort_ids,
    COALESCE(dep.department_ids, ARRAY[]::uuid[]) AS department_ids,
    COALESCE(prof.profile_ids, ARRAY[]::uuid[]) AS profile_ids,

    -- Aggregated UP from chat level
    COALESCE(trn.chat_ids, ARRAY[]::uuid[]) AS chat_ids,
    COALESCE(scn.scenario_ids, ARRAY[]::uuid[]) AS scenario_ids,
    COALESCE(rub.rubric_ids, ARRAY[]::uuid[]) AS rubric_ids,
    COALESCE(stl.scenario_time_limit_ids, ARRAY[]::uuid[]) AS scenario_time_limit_ids,

    pe.created_at,
    pe.updated_at,
    pe.active

FROM practice_entry pe
LEFT JOIN simulation_agg sim ON sim.practice_id = pe.id
LEFT JOIN cohort_agg coh ON coh.practice_id = pe.id
LEFT JOIN department_agg dep ON dep.practice_id = pe.id
LEFT JOIN profile_agg prof ON prof.practice_id = pe.id
LEFT JOIN chat_agg trn ON trn.practice_id = pe.id
LEFT JOIN scenario_agg scn ON scn.practice_id = pe.id
LEFT JOIN rubric_agg rub ON rub.practice_id = pe.id
LEFT JOIN scenario_time_limit_agg stl ON stl.practice_id = pe.id
WHERE pe.active = true
WITH NO DATA;
