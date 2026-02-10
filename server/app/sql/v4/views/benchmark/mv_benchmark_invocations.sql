-- Materialized View: mv_benchmark_invocations
-- Invocation-level facts for benchmark artifacts.
--
-- Grain: One row per benchmark invocation (benchmark_invocations_entry.id)
-- Purpose: Fast read model for benchmark invocation timelines.

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT indexname
        FROM pg_indexes
        WHERE schemaname = 'public'
          AND tablename = 'mv_benchmark_invocations'
    LOOP
        EXECUTE format('DROP INDEX IF EXISTS %I', r.indexname);
    END LOOP;
END $$;

DROP MATERIALIZED VIEW IF EXISTS mv_benchmark_invocations CASCADE;

CREATE MATERIALIZED VIEW mv_benchmark_invocations AS
WITH eval_links AS (
    SELECT
        c.attempt_id AS test_id,
        (ARRAY_AGG(c.evals_id ORDER BY c.created_at))[1] AS eval_id
    FROM benchmark_tests_evals_connection c
    WHERE c.active = true
    GROUP BY c.attempt_id
),
run_links AS (
    SELECT
        c.invocation_id,
        ARRAY_AGG(c.runs_id ORDER BY c.created_at) FILTER (WHERE c.runs_id IS NOT NULL) AS run_ids
    FROM benchmark_invocations_runs_connection c
    WHERE c.active = true
    GROUP BY c.invocation_id
),
latest_grade AS (
    SELECT DISTINCT ON (g.invocation_id)
        g.invocation_id,
        g.score AS grade_score,
        g.passed AS grade_passed,
        g.time_taken AS grade_time_taken
    FROM benchmark_grades_entry g
    WHERE g.active = true
    ORDER BY g.invocation_id, g.created_at DESC
),
message_counts AS (
    SELECT
        birc.invocation_id,
        COUNT(DISTINCT m.id)::bigint AS num_messages
    FROM benchmark_invocations_runs_connection birc
    JOIN runs_runs_connection rrc ON rrc.runs_id = birc.runs_id AND rrc.active = true
    JOIN messages_entry m ON m.run_id = rrc.run_id AND m.active = true
    WHERE birc.active = true
    GROUP BY birc.invocation_id
)
SELECT
    i.id AS invocation_id,
    i.test_id,
    el.eval_id,
    COALESCE(rl.run_ids, ARRAY[]::uuid[]) AS run_ids,
    i.group_id,
    i.created_at AS invocation_created_at,
    i.updated_at AS invocation_updated_at,
    i.title AS invocation_title,
    (
        lg.invocation_id IS NOT NULL
    ) AS invocation_completed,
    lg.grade_score,
    lg.grade_passed,
    lg.grade_time_taken,
    COALESCE(mc.num_messages, 0)::int AS num_messages
FROM benchmark_invocations_entry i
LEFT JOIN eval_links el ON el.test_id = i.test_id
LEFT JOIN run_links rl ON rl.invocation_id = i.id
LEFT JOIN latest_grade lg ON lg.invocation_id = i.id
LEFT JOIN message_counts mc ON mc.invocation_id = i.id
WHERE i.active = true
WITH NO DATA;

CREATE UNIQUE INDEX mv_benchmark_invocations_pk
    ON mv_benchmark_invocations (invocation_id);

CREATE INDEX mv_benchmark_invocations_test_id_idx
    ON mv_benchmark_invocations (test_id);

CREATE INDEX mv_benchmark_invocations_eval_id_idx
    ON mv_benchmark_invocations (eval_id);

CREATE INDEX mv_benchmark_invocations_completed_idx
    ON mv_benchmark_invocations (invocation_completed);

CREATE INDEX mv_benchmark_invocations_created_at_idx
    ON mv_benchmark_invocations (invocation_created_at DESC);

CREATE INDEX mv_benchmark_invocations_run_ids_gin
    ON mv_benchmark_invocations USING GIN (run_ids);

CREATE INDEX mv_benchmark_invocations_group_id_idx
    ON mv_benchmark_invocations (group_id);

REFRESH MATERIALIZED VIEW mv_benchmark_invocations;
