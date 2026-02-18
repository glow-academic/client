-- Materialized View: attempt_message_mv
-- Grain: One row per simulation message
-- Flat entry data only - no nested composites
--
-- Purpose: Provides flat message-level data for simulation views
-- Section: SIMULATION (lean MV)
--
-- Dependencies: attempt_message_entry, messages_entry, attempt_chat_entry,
--               attempt_entry, runs_runs_connection, texts_entry, audios_entry
-- ============================================================================
-- Step 1: Drop all indexes on attempt_message_mv materialized view (if it exists)
-- ============================================================================

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT indexname
        FROM pg_indexes
        WHERE schemaname = 'public'
          AND tablename = 'attempt_message_mv'
    LOOP
        EXECUTE format('DROP INDEX IF EXISTS %I', r.indexname);
    END LOOP;
END $$;

-- ============================================================================
-- Step 2: Drop attempt_message_mv materialized view if it exists
-- ============================================================================

DROP MATERIALIZED VIEW IF EXISTS attempt_message_mv CASCADE;

-- ============================================================================
-- Step 3: Create attempt_message_mv Materialized View
-- ============================================================================

CREATE MATERIALIZED VIEW attempt_message_mv AS
WITH
-- Get runs_id (resource) for each run_id (entry)
runs_resource_agg AS (
    SELECT
        rrc.run_id,
        rrc.runs_id
    FROM runs_runs_connection rrc
    WHERE rrc.active = TRUE
),
-- Audio entry ID per message
audio_agg AS (
    SELECT ae.message_id, ae.id AS audio_id
    FROM audios_entry ae
    WHERE ae.active = true AND ae.message_id IS NOT NULL
)
SELECT
    sm.id AS message_id,
    sm.chat_id,
    c.attempt_id,
    CASE WHEN m.role = 'user'::message_type THEN 'query' ELSE 'response' END AS type,
    (mc.message_id IS NOT NULL) AS completed,
    rra.runs_id,
    m.text_id,
    aa.audio_id,
    te.content AS history_content,
    m.created_at
FROM attempt_message_entry sm
JOIN messages_entry m ON m.id = sm.id
JOIN attempt_chat_entry c ON c.id = sm.chat_id
JOIN attempt_entry a ON a.id = c.attempt_id
LEFT JOIN LATERAL (
    SELECT archived FROM attempt_archive_entry
    WHERE attempt_id = a.id AND active = TRUE ORDER BY created_at DESC LIMIT 1
) sa_archive ON true
LEFT JOIN LATERAL (
    SELECT message_id FROM messages_completions_entry
    WHERE message_id = m.id AND active = TRUE ORDER BY created_at DESC LIMIT 1
) mc ON true
LEFT JOIN runs_resource_agg rra ON rra.run_id = m.run_id
LEFT JOIN texts_entry te ON te.id = m.text_id
LEFT JOIN audio_agg aa ON aa.message_id = sm.id
WHERE m.active = TRUE
  AND c.active = TRUE
  AND a.active = TRUE
  AND COALESCE(sa_archive.archived, FALSE) = FALSE
  AND m.role IN ('user'::message_type, 'assistant'::message_type)
WITH NO DATA;

-- ============================================================================
-- Step 4: Create Unique Index (Required for CONCURRENT refresh)
-- ============================================================================

CREATE UNIQUE INDEX attempt_message_mv_pk
    ON attempt_message_mv (message_id);

-- ============================================================================
-- Step 5: Create Filter/Slicing Indexes
-- ============================================================================

-- Chat ID for grouping
CREATE INDEX attempt_message_mv_chat_id_idx
    ON attempt_message_mv (chat_id);

-- Attempt ID for parallel lookup
CREATE INDEX attempt_message_mv_attempt_id_idx
    ON attempt_message_mv (attempt_id);

-- Composite: attempt + chat for ordering
CREATE INDEX attempt_message_mv_attempt_chat_idx
    ON attempt_message_mv (attempt_id, chat_id);

-- Message type for filtering
CREATE INDEX attempt_message_mv_type_idx
    ON attempt_message_mv (type);

-- Created at for ordering
CREATE INDEX attempt_message_mv_created_at_idx
    ON attempt_message_mv (created_at);

-- Runs ID for filtering by run
CREATE INDEX attempt_message_mv_runs_id_idx
    ON attempt_message_mv (runs_id)
    WHERE runs_id IS NOT NULL;

-- ============================================================================
-- Step 6: Refresh Materialized View with Data
-- ============================================================================

REFRESH MATERIALIZED VIEW attempt_message_mv;
