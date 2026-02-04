-- Materialized View: mv_benchmark_messages
-- Message-level facts for benchmark artifacts.
--
-- Grain: One row per benchmark message (messages_entry.id)
-- Purpose: Fast read model for benchmark transcript payloads.

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT indexname
        FROM pg_indexes
        WHERE schemaname = 'public'
          AND tablename = 'mv_benchmark_messages'
    LOOP
        EXECUTE format('DROP INDEX IF EXISTS %I', r.indexname);
    END LOOP;
END $$;

DROP MATERIALIZED VIEW IF EXISTS mv_benchmark_messages CASCADE;

CREATE MATERIALIZED VIEW mv_benchmark_messages AS
SELECT
    m.id AS message_id,
    bm.chat_id,
    c.attempt_id AS test_id,
    el.eval_id,
    m.run_id,
    m.role AS type,
    m.created_at,
    m.updated_at,
    COALESCE(m.completed, false) AS completed
FROM benchmark_messages_entry bm
JOIN messages_entry m ON m.id = bm.id
JOIN benchmark_chats_entry c ON c.id = bm.chat_id
LEFT JOIN LATERAL (
    SELECT e.evals_id AS eval_id
    FROM benchmark_tests_evals_connection e
    WHERE e.attempt_id = c.attempt_id
      AND e.active = true
    ORDER BY e.created_at ASC
    LIMIT 1
) el ON true
WHERE c.active = true
  AND m.active = true
WITH NO DATA;

CREATE UNIQUE INDEX mv_benchmark_messages_pk
    ON mv_benchmark_messages (message_id);

CREATE INDEX mv_benchmark_messages_chat_id_idx
    ON mv_benchmark_messages (chat_id);

CREATE INDEX mv_benchmark_messages_test_id_idx
    ON mv_benchmark_messages (test_id);

CREATE INDEX mv_benchmark_messages_eval_id_idx
    ON mv_benchmark_messages (eval_id);

CREATE INDEX mv_benchmark_messages_type_idx
    ON mv_benchmark_messages (type);

CREATE INDEX mv_benchmark_messages_created_at_idx
    ON mv_benchmark_messages (created_at DESC);

REFRESH MATERIALIZED VIEW mv_benchmark_messages;
