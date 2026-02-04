-- Materialized View: mv_benchmark_tests
-- Test-level facts for benchmark artifacts.
--
-- Grain: One row per benchmark test (benchmark_tests_entry.id)
-- Purpose: Fast filtering for list/get style endpoints without business rules.

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT indexname
        FROM pg_indexes
        WHERE schemaname = 'public'
          AND tablename = 'mv_benchmark_tests'
    LOOP
        EXECUTE format('DROP INDEX IF EXISTS %I', r.indexname);
    END LOOP;
END $$;

DROP MATERIALIZED VIEW IF EXISTS mv_benchmark_tests CASCADE;

CREATE MATERIALIZED VIEW mv_benchmark_tests AS
WITH eval_links AS (
    SELECT
        c.attempt_id AS test_id,
        (ARRAY_AGG(c.evals_id ORDER BY c.created_at))[1] AS eval_id
    FROM benchmark_tests_evals_connection c
    WHERE c.active = true
    GROUP BY c.attempt_id
),
profile_links AS (
    SELECT
        c.attempt_id AS test_id,
        (ARRAY_AGG(c.profiles_id ORDER BY c.created_at))[1] AS profile_id
    FROM benchmark_tests_profiles_connection c
    WHERE c.active = true
    GROUP BY c.attempt_id
),
department_links AS (
    SELECT
        c.attempt_id AS test_id,
        ARRAY_AGG(DISTINCT c.departments_id) FILTER (WHERE c.departments_id IS NOT NULL) AS department_ids
    FROM benchmark_tests_departments_connection c
    WHERE c.active = true
    GROUP BY c.attempt_id
),
chat_counts AS (
    SELECT
        c.attempt_id AS test_id,
        COUNT(*)::bigint AS num_chats,
        COUNT(*) FILTER (WHERE c.completed = true)::bigint AS num_chats_completed
    FROM benchmark_chats_entry c
    WHERE c.active = true
    GROUP BY c.attempt_id
),
message_counts AS (
    SELECT
        c.attempt_id AS test_id,
        COUNT(*)::bigint AS num_messages
    FROM benchmark_messages_entry m
    JOIN benchmark_chats_entry c ON c.id = m.chat_id
    WHERE c.active = true
    GROUP BY c.attempt_id
)
SELECT
    t.id AS test_id,
    el.eval_id,
    pl.profile_id,
    COALESCE(dl.department_ids, ARRAY[]::uuid[]) AS department_ids,
    t.infinite_mode,
    COALESCE(t.archived, false) AS archived,
    t.created_at AS test_created_at,
    t.updated_at AS test_updated_at,
    COALESCE(cc.num_chats, 0)::int AS num_chats,
    COALESCE(cc.num_chats_completed, 0)::int AS num_chats_completed,
    COALESCE(mc.num_messages, 0)::int AS num_messages
FROM benchmark_tests_entry t
LEFT JOIN eval_links el ON el.test_id = t.id
LEFT JOIN profile_links pl ON pl.test_id = t.id
LEFT JOIN department_links dl ON dl.test_id = t.id
LEFT JOIN chat_counts cc ON cc.test_id = t.id
LEFT JOIN message_counts mc ON mc.test_id = t.id
WHERE t.active = true
WITH NO DATA;

CREATE UNIQUE INDEX mv_benchmark_tests_pk
    ON mv_benchmark_tests (test_id);

CREATE INDEX mv_benchmark_tests_eval_id_idx
    ON mv_benchmark_tests (eval_id);

CREATE INDEX mv_benchmark_tests_profile_id_idx
    ON mv_benchmark_tests (profile_id);

CREATE INDEX mv_benchmark_tests_archived_idx
    ON mv_benchmark_tests (archived);

CREATE INDEX mv_benchmark_tests_created_at_idx
    ON mv_benchmark_tests (test_created_at DESC);

CREATE INDEX mv_benchmark_tests_department_ids_gin
    ON mv_benchmark_tests USING GIN (department_ids);

REFRESH MATERIALIZED VIEW mv_benchmark_tests;
