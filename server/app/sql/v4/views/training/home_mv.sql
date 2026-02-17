-- Materialized View: home_mv
-- Home-level denormalized context for the home training list/cards page.
--
-- Grain: One row per home_entry.id
-- All resource IDs from home_*_connection tables.
-- Training-level resources (scenario_ids) aggregated UP from
-- home_training_entry → training_entry → training_scenarios_connection.

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT indexname
        FROM pg_indexes
        WHERE schemaname = 'public'
          AND tablename = 'home_mv'
    LOOP
        EXECUTE format('DROP INDEX IF EXISTS %I', r.indexname);
    END LOOP;
END $$;

DROP MATERIALIZED VIEW IF EXISTS home_mv CASCADE;

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
rubric_agg AS (
    SELECT
        hrc.home_id,
        ARRAY_AGG(DISTINCT hrc.scenario_rubrics_id ORDER BY hrc.scenario_rubrics_id) AS rubric_ids
    FROM home_rubrics_connection hrc
    WHERE hrc.active = true
    GROUP BY hrc.home_id
),
time_limit_agg AS (
    SELECT
        htlc.home_id,
        ARRAY_AGG(DISTINCT htlc.scenario_time_limits_id ORDER BY htlc.scenario_time_limits_id) AS time_limit_ids
    FROM home_time_limits_connection htlc
    WHERE htlc.active = true
    GROUP BY htlc.home_id
),
-- Simulation-level scenario resource connections
flag_agg AS (
    SELECT
        hsfc.home_id,
        ARRAY_AGG(DISTINCT hsfc.scenario_flags_id ORDER BY hsfc.scenario_flags_id) AS flag_ids
    FROM home_scenario_flags_connection hsfc
    WHERE hsfc.active = true
    GROUP BY hsfc.home_id
),
position_agg AS (
    SELECT
        hspc.home_id,
        ARRAY_AGG(DISTINCT hspc.scenario_positions_id ORDER BY hspc.scenario_positions_id) AS position_ids
    FROM home_scenario_positions_connection hspc
    WHERE hspc.active = true
    GROUP BY hspc.home_id
),
persona_agg AS (
    SELECT
        hspc.home_id,
        ARRAY_AGG(DISTINCT hspc.scenario_personas_id ORDER BY hspc.scenario_personas_id) AS persona_ids
    FROM home_scenario_personas_connection hspc
    WHERE hspc.active = true
    GROUP BY hspc.home_id
),
-- Training level connections (aggregated UP to home_entry via home_training_entry)
training_agg AS (
    SELECT
        hte.home_id,
        ARRAY_AGG(DISTINCT hte.training_id ORDER BY hte.training_id) AS training_ids
    FROM home_training_entry hte
    WHERE hte.active = true
    GROUP BY hte.home_id
),
scenario_agg AS (
    SELECT
        hte.home_id,
        ARRAY_AGG(DISTINCT tsc.scenarios_id ORDER BY tsc.scenarios_id) AS scenario_ids
    FROM home_training_entry hte
    JOIN training_scenarios_connection tsc
      ON tsc.training_id = hte.training_id AND tsc.active = true
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
    COALESCE(rub.rubric_ids, ARRAY[]::uuid[]) AS rubric_ids,
    COALESCE(tl.time_limit_ids, ARRAY[]::uuid[]) AS time_limit_ids,

    -- Simulation-level scenario resource connections
    COALESCE(flg.flag_ids, ARRAY[]::uuid[]) AS flag_ids,
    COALESCE(pos.position_ids, ARRAY[]::uuid[]) AS position_ids,
    COALESCE(per.persona_ids, ARRAY[]::uuid[]) AS persona_ids,

    -- Aggregated UP from training level
    COALESCE(trn.training_ids, ARRAY[]::uuid[]) AS training_ids,
    COALESCE(scn.scenario_ids, ARRAY[]::uuid[]) AS scenario_ids,

    he.created_at,
    he.updated_at,
    he.active

FROM home_entry he
LEFT JOIN simulation_agg sim ON sim.home_id = he.id
LEFT JOIN cohort_agg coh ON coh.home_id = he.id
LEFT JOIN department_agg dep ON dep.home_id = he.id
LEFT JOIN profile_agg prof ON prof.home_id = he.id
LEFT JOIN rubric_agg rub ON rub.home_id = he.id
LEFT JOIN time_limit_agg tl ON tl.home_id = he.id
LEFT JOIN flag_agg flg ON flg.home_id = he.id
LEFT JOIN position_agg pos ON pos.home_id = he.id
LEFT JOIN persona_agg per ON per.home_id = he.id
LEFT JOIN training_agg trn ON trn.home_id = he.id
LEFT JOIN scenario_agg scn ON scn.home_id = he.id
WHERE he.active = true
WITH NO DATA;

CREATE UNIQUE INDEX home_mv_pk
    ON home_mv (home_id);

CREATE INDEX home_mv_simulation_ids_gin_idx
    ON home_mv USING GIN (simulation_ids);

CREATE INDEX home_mv_cohort_ids_gin_idx
    ON home_mv USING GIN (cohort_ids);

CREATE INDEX home_mv_profile_ids_gin_idx
    ON home_mv USING GIN (profile_ids);

CREATE INDEX home_mv_scenario_ids_gin_idx
    ON home_mv USING GIN (scenario_ids);

REFRESH MATERIALIZED VIEW home_mv;
