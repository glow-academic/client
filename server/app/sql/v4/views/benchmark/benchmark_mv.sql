-- Materialized View: benchmark_mv
-- Benchmark-entry-level denormalized context for the benchmark list/cards page.
--
-- Grain: One row per benchmark_entry.id
-- All resource IDs from connection tables, never direct FKs.
-- Benchmark = eval-level parameters (runtime config).
-- Bundle IDs aggregated UP from benchmark_bundle level.

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT indexname
        FROM pg_indexes
        WHERE schemaname = 'public'
          AND tablename = 'benchmark_mv'
    LOOP
        EXECUTE format('DROP INDEX IF EXISTS %I', r.indexname);
    END LOOP;
END $$;

DROP MATERIALIZED VIEW IF EXISTS benchmark_mv CASCADE;

CREATE MATERIALIZED VIEW benchmark_mv AS
WITH
-- benchmark_entry level connections
eval_agg AS (
    SELECT
        bec.benchmark_id,
        ARRAY_AGG(DISTINCT bec.evals_id ORDER BY bec.evals_id) AS eval_ids
    FROM benchmark_evals_connection bec
    WHERE bec.active = true
    GROUP BY bec.benchmark_id
),
profile_agg AS (
    SELECT
        bpc.benchmark_id,
        ARRAY_AGG(DISTINCT bpc.profiles_id ORDER BY bpc.profiles_id) AS profile_ids
    FROM benchmark_profiles_connection bpc
    WHERE bpc.active = true
    GROUP BY bpc.benchmark_id
),
department_agg AS (
    SELECT
        bdc.benchmark_id,
        ARRAY_AGG(DISTINCT bdc.departments_id ORDER BY bdc.departments_id) AS department_ids
    FROM benchmark_departments_connection bdc
    WHERE bdc.active = true
    GROUP BY bdc.benchmark_id
),
run_rubric_agg AS (
    SELECT
        brrc.benchmark_id,
        ARRAY_AGG(DISTINCT brrc.run_rubrics_id ORDER BY brrc.run_rubrics_id) AS run_rubric_ids
    FROM test_run_rubrics_connection brrc
    WHERE brrc.active = true
    GROUP BY brrc.benchmark_id
),
group_rubric_agg AS (
    SELECT
        bgrc.benchmark_id,
        ARRAY_AGG(DISTINCT bgrc.group_rubrics_id ORDER BY bgrc.group_rubrics_id) AS group_rubric_ids
    FROM test_group_rubrics_connection bgrc
    WHERE bgrc.active = true
    GROUP BY bgrc.benchmark_id
),
run_position_agg AS (
    SELECT
        brpc.benchmark_id,
        ARRAY_AGG(DISTINCT brpc.run_positions_id ORDER BY brpc.run_positions_id) AS run_position_ids
    FROM test_run_positions_connection brpc
    WHERE brpc.active = true
    GROUP BY brpc.benchmark_id
),
group_position_agg AS (
    SELECT
        bgpc.benchmark_id,
        ARRAY_AGG(DISTINCT bgpc.group_positions_id ORDER BY bgpc.group_positions_id) AS group_position_ids
    FROM test_group_positions_connection bgpc
    WHERE bgpc.active = true
    GROUP BY bgpc.benchmark_id
),
-- benchmark_bundle level (aggregated UP to benchmark_entry)
bundle_agg AS (
    SELECT
        bbe.benchmark_id,
        ARRAY_AGG(DISTINCT bbe.id ORDER BY bbe.id) AS suite_entry_ids
    FROM suite_entry bbe
    WHERE bbe.active = true
    GROUP BY bbe.benchmark_id
)
SELECT
    be.id AS benchmark_id,

    -- Filter flags
    be.use_groups,
    be.dynamic,

    -- benchmark_entry level connections
    COALESCE(ev.eval_ids, ARRAY[]::uuid[]) AS eval_ids,
    COALESCE(prof.profile_ids, ARRAY[]::uuid[]) AS profile_ids,
    COALESCE(dep.department_ids, ARRAY[]::uuid[]) AS department_ids,
    COALESCE(rr.run_rubric_ids, ARRAY[]::uuid[]) AS run_rubric_ids,
    COALESCE(gr.group_rubric_ids, ARRAY[]::uuid[]) AS group_rubric_ids,
    COALESCE(rp.run_position_ids, ARRAY[]::uuid[]) AS run_position_ids,
    COALESCE(gp.group_position_ids, ARRAY[]::uuid[]) AS group_position_ids,

    -- Aggregated UP from benchmark_bundle level
    COALESCE(bun.suite_entry_ids, ARRAY[]::uuid[]) AS suite_entry_ids,

    be.created_at,
    be.updated_at,
    be.active

FROM benchmark_entry be
LEFT JOIN eval_agg ev ON ev.benchmark_id = be.id
LEFT JOIN profile_agg prof ON prof.benchmark_id = be.id
LEFT JOIN department_agg dep ON dep.benchmark_id = be.id
LEFT JOIN run_rubric_agg rr ON rr.benchmark_id = be.id
LEFT JOIN group_rubric_agg gr ON gr.benchmark_id = be.id
LEFT JOIN run_position_agg rp ON rp.benchmark_id = be.id
LEFT JOIN group_position_agg gp ON gp.benchmark_id = be.id
LEFT JOIN bundle_agg bun ON bun.benchmark_id = be.id
WHERE be.active = true
WITH NO DATA;

CREATE UNIQUE INDEX benchmark_mv_pk
    ON benchmark_mv (benchmark_id);

CREATE INDEX benchmark_mv_use_groups_idx
    ON benchmark_mv (use_groups);

CREATE INDEX benchmark_mv_dynamic_idx
    ON benchmark_mv (dynamic);

CREATE INDEX benchmark_mv_eval_ids_gin_idx
    ON benchmark_mv USING GIN (eval_ids);

CREATE INDEX benchmark_mv_department_ids_gin_idx
    ON benchmark_mv USING GIN (department_ids);

CREATE INDEX benchmark_mv_profile_ids_gin_idx
    ON benchmark_mv USING GIN (profile_ids);

REFRESH MATERIALIZED VIEW benchmark_mv;
