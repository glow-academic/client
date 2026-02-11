-- Materialized View: mv_training
-- Training-level denormalized context for the training list/cards page.
--
-- Grain: One row per training_entry.id
-- All resource IDs from connection tables, never direct FKs.
-- Cross-level resources (persona_ids, scenario_ids) aggregated UP from
-- training_bundle level connections at MV join layer.

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT indexname
        FROM pg_indexes
        WHERE schemaname = 'public'
          AND tablename = 'mv_training'
    LOOP
        EXECUTE format('DROP INDEX IF EXISTS %I', r.indexname);
    END LOOP;
END $$;

DROP MATERIALIZED VIEW IF EXISTS mv_training CASCADE;

CREATE MATERIALIZED VIEW mv_training AS
WITH
-- training_entry level connections
simulation_agg AS (
    SELECT
        tsc.training_id,
        ARRAY_AGG(DISTINCT tsc.simulations_id ORDER BY tsc.simulations_id) AS simulation_ids
    FROM training_simulations_connection tsc
    WHERE tsc.active = true
    GROUP BY tsc.training_id
),
cohort_agg AS (
    SELECT
        tcc.training_id,
        ARRAY_AGG(DISTINCT tcc.cohorts_id ORDER BY tcc.cohorts_id) AS cohort_ids
    FROM training_cohorts_connection tcc
    WHERE tcc.active = true
    GROUP BY tcc.training_id
),
department_agg AS (
    SELECT
        tdc.training_id,
        ARRAY_AGG(DISTINCT tdc.departments_id ORDER BY tdc.departments_id) AS department_ids
    FROM training_departments_connection tdc
    WHERE tdc.active = true
    GROUP BY tdc.training_id
),
profile_agg AS (
    SELECT
        tpc.training_id,
        ARRAY_AGG(DISTINCT tpc.profiles_id ORDER BY tpc.profiles_id) AS profile_ids
    FROM training_profiles_connection tpc
    WHERE tpc.active = true
    GROUP BY tpc.training_id
),
rubric_agg AS (
    SELECT
        trc.training_id,
        ARRAY_AGG(DISTINCT trc.rubrics_id ORDER BY trc.rubrics_id) AS rubric_ids
    FROM training_rubrics_connection trc
    WHERE trc.active = true
    GROUP BY trc.training_id
),
time_limit_agg AS (
    SELECT
        ttlc.training_id,
        ARRAY_AGG(DISTINCT ttlc.scenario_time_limits_id ORDER BY ttlc.scenario_time_limits_id) AS time_limit_ids
    FROM training_time_limits_connection ttlc
    WHERE ttlc.active = true
    GROUP BY ttlc.training_id
),
standard_group_agg AS (
    SELECT
        tsgc.training_id,
        ARRAY_AGG(DISTINCT tsgc.standard_groups_id ORDER BY tsgc.standard_groups_id) AS standard_group_ids
    FROM training_standard_groups_connection tsgc
    WHERE tsgc.active = true
    GROUP BY tsgc.training_id
),
standard_agg AS (
    SELECT
        tsc.training_id,
        ARRAY_AGG(DISTINCT tsc.standards_id ORDER BY tsc.standards_id) AS standard_ids
    FROM training_standards_connection tsc
    WHERE tsc.active = true
    GROUP BY tsc.training_id
),
-- training_bundle level connections (aggregated UP to training_entry)
bundle_agg AS (
    SELECT
        tb.training_id,
        ARRAY_AGG(DISTINCT tb.id ORDER BY tb.id) AS training_bundle_entry_ids
    FROM training_bundle_entry tb
    WHERE tb.active = true
    GROUP BY tb.training_id
),
scenario_agg AS (
    SELECT
        tb.training_id,
        ARRAY_AGG(DISTINCT tbsc.scenarios_id ORDER BY tbsc.scenarios_id) AS scenario_ids
    FROM training_bundle_entry tb
    JOIN training_bundle_scenarios_connection tbsc
      ON tbsc.training_bundle_id = tb.id AND tbsc.active = true
    WHERE tb.active = true
    GROUP BY tb.training_id
),
persona_agg AS (
    SELECT
        tb.training_id,
        ARRAY_AGG(DISTINCT tbpc.personas_id ORDER BY tbpc.personas_id) AS persona_ids
    FROM training_bundle_entry tb
    JOIN training_bundle_personas_connection tbpc
      ON tbpc.training_bundle_id = tb.id AND tbpc.active = true
    WHERE tb.active = true
    GROUP BY tb.training_id
)
SELECT
    te.id AS training_id,

    -- Behavior flags
    te.practice,
    te.audio_enabled,
    te.text_enabled,
    te.hints_enabled,
    te.copy_paste_allowed,
    te.show_images,
    te.show_objectives,
    te.show_problem_statement,

    -- training_entry level connections
    COALESCE(sim.simulation_ids, ARRAY[]::uuid[]) AS simulation_ids,
    COALESCE(coh.cohort_ids, ARRAY[]::uuid[]) AS cohort_ids,
    COALESCE(dep.department_ids, ARRAY[]::uuid[]) AS department_ids,
    COALESCE(prof.profile_ids, ARRAY[]::uuid[]) AS profile_ids,
    COALESCE(rub.rubric_ids, ARRAY[]::uuid[]) AS rubric_ids,
    COALESCE(tl.time_limit_ids, ARRAY[]::uuid[]) AS time_limit_ids,
    COALESCE(sg.standard_group_ids, ARRAY[]::uuid[]) AS standard_group_ids,
    COALESCE(std.standard_ids, ARRAY[]::uuid[]) AS standard_ids,

    -- Aggregated UP from training_bundle level
    COALESCE(bun.training_bundle_entry_ids, ARRAY[]::uuid[]) AS training_bundle_entry_ids,
    COALESCE(scn.scenario_ids, ARRAY[]::uuid[]) AS scenario_ids,
    COALESCE(per.persona_ids, ARRAY[]::uuid[]) AS persona_ids,

    te.created_at,
    te.updated_at,
    te.active

FROM training_entry te
LEFT JOIN simulation_agg sim ON sim.training_id = te.id
LEFT JOIN cohort_agg coh ON coh.training_id = te.id
LEFT JOIN department_agg dep ON dep.training_id = te.id
LEFT JOIN profile_agg prof ON prof.training_id = te.id
LEFT JOIN rubric_agg rub ON rub.training_id = te.id
LEFT JOIN time_limit_agg tl ON tl.training_id = te.id
LEFT JOIN standard_group_agg sg ON sg.training_id = te.id
LEFT JOIN standard_agg std ON std.training_id = te.id
LEFT JOIN bundle_agg bun ON bun.training_id = te.id
LEFT JOIN scenario_agg scn ON scn.training_id = te.id
LEFT JOIN persona_agg per ON per.training_id = te.id
WHERE te.active = true
WITH NO DATA;

CREATE UNIQUE INDEX mv_training_pk
    ON mv_training (training_id);

CREATE INDEX mv_training_practice_idx
    ON mv_training (practice);

CREATE INDEX mv_training_simulation_ids_gin_idx
    ON mv_training USING GIN (simulation_ids);

CREATE INDEX mv_training_cohort_ids_gin_idx
    ON mv_training USING GIN (cohort_ids);

CREATE INDEX mv_training_profile_ids_gin_idx
    ON mv_training USING GIN (profile_ids);

CREATE INDEX mv_training_scenario_ids_gin_idx
    ON mv_training USING GIN (scenario_ids);

REFRESH MATERIALIZED VIEW mv_training;
