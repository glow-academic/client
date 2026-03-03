-- Materialized View: home_mv
-- Home-level denormalized context for the home training list/cards page.
--
-- Grain: One row per home_entry.id
-- All resource IDs from home_*_connection tables.
-- Chat-level resources (scenario_ids) aggregated UP from
-- home_chat_entry -> chat_entry -> chat_scenarios_connection.

CREATE MATERIALIZED VIEW home_mv AS
WITH
-- home_entry level connections
simulation_agg AS (
    SELECT
        hsc.home_id,
        ARRAY_AGG(DISTINCT hsc.simulations_id ORDER BY hsc.simulations_id) AS simulation_ids
    FROM home_simulations_connection hsc
    WHERE hsc.active = true
    GROUP BY hsc.home_id
),
cohort_agg AS (
    SELECT
        hcc.home_id,
        ARRAY_AGG(DISTINCT hcc.cohorts_id ORDER BY hcc.cohorts_id) AS cohort_ids
    FROM home_cohorts_connection hcc
    WHERE hcc.active = true
    GROUP BY hcc.home_id
),
department_agg AS (
    SELECT
        hdc.home_id,
        ARRAY_AGG(DISTINCT hdc.departments_id ORDER BY hdc.departments_id) AS department_ids
    FROM home_departments_connection hdc
    WHERE hdc.active = true
    GROUP BY hdc.home_id
),
profile_agg AS (
    SELECT
        hpc.home_id,
        ARRAY_AGG(DISTINCT hpc.profiles_id ORDER BY hpc.profiles_id) AS profile_ids
    FROM home_profiles_connection hpc
    WHERE hpc.active = true
    GROUP BY hpc.home_id
),
-- Chat level connections (aggregated UP to home_entry via home_chat_entry)
chat_agg AS (
    SELECT
        hte.home_id,
        ARRAY_AGG(DISTINCT hte.chat_id ORDER BY hte.chat_id) AS chat_ids
    FROM home_chat_entry hte
    WHERE hte.active = true
    GROUP BY hte.home_id
),
scenario_agg AS (
    SELECT
        hte.home_id,
        ARRAY_AGG(DISTINCT tsc.scenarios_id ORDER BY tsc.scenarios_id) AS scenario_ids
    FROM home_chat_entry hte
    JOIN chat_scenarios_connection tsc
      ON tsc.chat_id = hte.chat_id AND tsc.active = true
    WHERE hte.active = true
    GROUP BY hte.home_id
)
SELECT
    he.id AS home_id,

    -- home_entry level connections
    COALESCE(sim.simulation_ids, ARRAY[]::uuid[]) AS simulation_ids,
    COALESCE(coh.cohort_ids, ARRAY[]::uuid[]) AS cohort_ids,
    COALESCE(dep.department_ids, ARRAY[]::uuid[]) AS department_ids,
    COALESCE(prof.profile_ids, ARRAY[]::uuid[]) AS profile_ids,

    -- Aggregated UP from chat level
    COALESCE(trn.chat_ids, ARRAY[]::uuid[]) AS chat_ids,
    COALESCE(scn.scenario_ids, ARRAY[]::uuid[]) AS scenario_ids,

    he.created_at,
    he.updated_at,
    he.active

FROM home_entry he
LEFT JOIN simulation_agg sim ON sim.home_id = he.id
LEFT JOIN cohort_agg coh ON coh.home_id = he.id
LEFT JOIN department_agg dep ON dep.home_id = he.id
LEFT JOIN profile_agg prof ON prof.home_id = he.id
LEFT JOIN chat_agg trn ON trn.home_id = he.id
LEFT JOIN scenario_agg scn ON scn.home_id = he.id
WHERE he.active = true
WITH NO DATA;
