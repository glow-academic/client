-- Materialized View: mv_benchmark_chats
-- Chat-level facts for benchmark artifacts.
--
-- Grain: One row per benchmark chat (benchmark_chats_entry.id)
-- Purpose: Fast read model for benchmark chat timelines.

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT indexname
        FROM pg_indexes
        WHERE schemaname = 'public'
          AND tablename = 'mv_benchmark_chats'
    LOOP
        EXECUTE format('DROP INDEX IF EXISTS %I', r.indexname);
    END LOOP;
END $$;

DROP MATERIALIZED VIEW IF EXISTS mv_benchmark_chats CASCADE;

CREATE MATERIALIZED VIEW mv_benchmark_chats AS
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
        c.chat_id,
        ARRAY_AGG(c.runs_id ORDER BY c.created_at) FILTER (WHERE c.runs_id IS NOT NULL) AS run_ids
    FROM benchmark_chats_runs_connection c
    WHERE c.active = true
    GROUP BY c.chat_id
),
group_links AS (
    SELECT
        c.chat_id,
        ARRAY_AGG(c.groups_id ORDER BY c.created_at) FILTER (WHERE c.groups_id IS NOT NULL) AS group_ids
    FROM benchmark_chats_groups_connection c
    WHERE c.active = true
    GROUP BY c.chat_id
),
latest_grade AS (
    SELECT DISTINCT ON (g.chat_id)
        g.chat_id,
        g.score AS grade_score,
        g.passed AS grade_passed,
        g.time_taken AS grade_time_taken
    FROM benchmark_grades_entry g
    WHERE g.active = true
    ORDER BY g.chat_id, g.created_at DESC
),
message_counts AS (
    SELECT
        m.chat_id,
        COUNT(*)::bigint AS num_messages
    FROM benchmark_messages_entry m
    GROUP BY m.chat_id
)
SELECT
    c.id AS chat_id,
    c.attempt_id AS test_id,
    el.eval_id,
    COALESCE(rl.run_ids, ARRAY[]::uuid[]) AS run_ids,
    COALESCE(gl.group_ids, ARRAY[]::uuid[]) AS group_ids,
    c.created_at AS chat_created_at,
    c.updated_at AS chat_updated_at,
    c.title AS chat_title,
    (EXISTS (SELECT 1 FROM benchmark_completions_entry comp WHERE comp.chat_id = c.id AND comp.active = TRUE)) AS chat_completed,
    lg.grade_score,
    lg.grade_passed,
    lg.grade_time_taken,
    COALESCE(mc.num_messages, 0)::int AS num_messages
FROM benchmark_chats_entry c
LEFT JOIN eval_links el ON el.test_id = c.attempt_id
LEFT JOIN run_links rl ON rl.chat_id = c.id
LEFT JOIN group_links gl ON gl.chat_id = c.id
LEFT JOIN latest_grade lg ON lg.chat_id = c.id
LEFT JOIN message_counts mc ON mc.chat_id = c.id
WHERE c.active = true
WITH NO DATA;

CREATE UNIQUE INDEX mv_benchmark_chats_pk
    ON mv_benchmark_chats (chat_id);

CREATE INDEX mv_benchmark_chats_test_id_idx
    ON mv_benchmark_chats (test_id);

CREATE INDEX mv_benchmark_chats_eval_id_idx
    ON mv_benchmark_chats (eval_id);

CREATE INDEX mv_benchmark_chats_completed_idx
    ON mv_benchmark_chats (chat_completed);

CREATE INDEX mv_benchmark_chats_created_at_idx
    ON mv_benchmark_chats (chat_created_at DESC);

CREATE INDEX mv_benchmark_chats_run_ids_gin
    ON mv_benchmark_chats USING GIN (run_ids);

CREATE INDEX mv_benchmark_chats_group_ids_gin
    ON mv_benchmark_chats USING GIN (group_ids);

REFRESH MATERIALIZED VIEW mv_benchmark_chats;
