-- Materialized View: practice_mv
-- Practice-level denormalized context for the practice training list/cards page.
--
-- Grain: One row per practice_entry.id
-- All resource IDs from practice_*_connection tables.
-- Training-level resources (scenario_ids) aggregated UP from
-- practice_training_entry → training_entry → training_scenarios_connection.

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT indexname
        FROM pg_indexes
        WHERE schemaname = 'public'
          AND tablename = 'practice_mv'
    LOOP
        EXECUTE format('DROP INDEX IF EXISTS %I', r.indexname);
    END LOOP;
END $$;

DROP MATERIALIZED VIEW IF EXISTS practice_mv CASCADE;

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
rubric_agg AS (
    SELECT
        prc.practice_id,
        ARRAY_AGG(DISTINCT prc.rubrics_id ORDER BY prc.rubrics_id) AS rubric_ids
    FROM practice_rubrics_connection prc
    WHERE prc.active = true
    GROUP BY prc.practice_id
),
time_limit_agg AS (
    SELECT
        ptlc.practice_id,
        ARRAY_AGG(DISTINCT ptlc.scenario_time_limits_id ORDER BY ptlc.scenario_time_limits_id) AS time_limit_ids
    FROM practice_time_limits_connection ptlc
    WHERE ptlc.active = true
    GROUP BY ptlc.practice_id
),
-- Simulation-level scenario resource connections
flag_agg AS (
    SELECT
        psfc.practice_id,
        ARRAY_AGG(DISTINCT psfc.scenario_flags_id ORDER BY psfc.scenario_flags_id) AS flag_ids
    FROM practice_scenario_flags_connection psfc
    WHERE psfc.active = true
    GROUP BY psfc.practice_id
),
position_agg AS (
    SELECT
        pspc.practice_id,
        ARRAY_AGG(DISTINCT pspc.scenario_positions_id ORDER BY pspc.scenario_positions_id) AS position_ids
    FROM practice_scenario_positions_connection pspc
    WHERE pspc.active = true
    GROUP BY pspc.practice_id
),
persona_agg AS (
    SELECT
        pspc.practice_id,
        ARRAY_AGG(DISTINCT pspc.scenario_personas_id ORDER BY pspc.scenario_personas_id) AS persona_ids
    FROM practice_scenario_personas_connection pspc
    WHERE pspc.active = true
    GROUP BY pspc.practice_id
),
-- Training level connections (aggregated UP to practice_entry via practice_training_entry)
training_agg AS (
    SELECT
        pte.practice_id,
        ARRAY_AGG(DISTINCT pte.training_id ORDER BY pte.training_id) AS training_ids
    FROM practice_training_entry pte
    WHERE pte.active = true
    GROUP BY pte.practice_id
),
scenario_agg AS (
    SELECT
        pte.practice_id,
        ARRAY_AGG(DISTINCT tsc.scenarios_id ORDER BY tsc.scenarios_id) AS scenario_ids
    FROM practice_training_entry pte
    JOIN training_scenarios_connection tsc
      ON tsc.training_id = pte.training_id AND tsc.active = true
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
    COALESCE(rub.rubric_ids, ARRAY[]::uuid[]) AS rubric_ids,
    COALESCE(tl.time_limit_ids, ARRAY[]::uuid[]) AS time_limit_ids,

    -- Simulation-level scenario resource connections
    COALESCE(flg.flag_ids, ARRAY[]::uuid[]) AS flag_ids,
    COALESCE(pos.position_ids, ARRAY[]::uuid[]) AS position_ids,
    COALESCE(per.persona_ids, ARRAY[]::uuid[]) AS persona_ids,

    -- Aggregated UP from training level
    COALESCE(trn.training_ids, ARRAY[]::uuid[]) AS training_ids,
    COALESCE(scn.scenario_ids, ARRAY[]::uuid[]) AS scenario_ids,

    pe.created_at,
    pe.updated_at,
    pe.active

FROM practice_entry pe
LEFT JOIN simulation_agg sim ON sim.practice_id = pe.id
LEFT JOIN cohort_agg coh ON coh.practice_id = pe.id
LEFT JOIN department_agg dep ON dep.practice_id = pe.id
LEFT JOIN profile_agg prof ON prof.practice_id = pe.id
LEFT JOIN rubric_agg rub ON rub.practice_id = pe.id
LEFT JOIN time_limit_agg tl ON tl.practice_id = pe.id
LEFT JOIN flag_agg flg ON flg.practice_id = pe.id
LEFT JOIN position_agg pos ON pos.practice_id = pe.id
LEFT JOIN persona_agg per ON per.practice_id = pe.id
LEFT JOIN training_agg trn ON trn.practice_id = pe.id
LEFT JOIN scenario_agg scn ON scn.practice_id = pe.id
WHERE pe.active = true
WITH NO DATA;

CREATE UNIQUE INDEX practice_mv_pk
    ON practice_mv (practice_id);

CREATE INDEX practice_mv_simulation_ids_gin_idx
    ON practice_mv USING GIN (simulation_ids);

CREATE INDEX practice_mv_cohort_ids_gin_idx
    ON practice_mv USING GIN (cohort_ids);

CREATE INDEX practice_mv_profile_ids_gin_idx
    ON practice_mv USING GIN (profile_ids);

CREATE INDEX practice_mv_scenario_ids_gin_idx
    ON practice_mv USING GIN (scenario_ids);

REFRESH MATERIALIZED VIEW practice_mv;
