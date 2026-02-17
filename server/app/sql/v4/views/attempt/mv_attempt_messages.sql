-- Materialized View: mv_attempt_messages
-- Message-level data for attempt detail views.
--
-- Grain: One row per message
-- Filter: archived = FALSE only
-- Note: Practice filtering done at attempt level, position derived in service layer
--
-- Purpose: Provides lean message-level data for parallel fetching
-- Section: ATTEMPT (unified view - both home and practice)
--
-- Dependencies: Only uses _entry and _connection tables
-- ============================================================================
-- Step 1: Drop all indexes on mv_attempt_messages materialized view (if it exists)
-- ============================================================================

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT indexname
        FROM pg_indexes
        WHERE schemaname = 'public'
          AND tablename = 'mv_attempt_messages'
    LOOP
        EXECUTE format('DROP INDEX IF EXISTS %I', r.indexname);
    END LOOP;
END $$;

-- ============================================================================
-- Step 2: Drop mv_attempt_messages materialized view if it exists
-- ============================================================================

DROP MATERIALIZED VIEW IF EXISTS mv_attempt_messages CASCADE;

-- ============================================================================
-- Step 3: Create mv_attempt_messages Materialized View
-- ============================================================================

CREATE MATERIALIZED VIEW mv_attempt_messages AS
WITH
-- Audio entry ID per message
audio_agg AS (
    SELECT ae.message_id, ae.id AS audio_id
    FROM audios_entry ae
    WHERE ae.active = true AND ae.message_id IS NOT NULL
),
-- Get runs_id (resource) for each run_id (entry)
runs_resource_agg AS (
    SELECT
        rrc.run_id,
        rrc.runs_id
    FROM runs_runs_connection rrc
    WHERE rrc.active = TRUE
),
-- Base message data (position derived in service layer, practice on attempt level)
base_messages AS (
    SELECT
        sm.id AS message_id,
        sm.chat_id,
        c.attempt_id,
        m.role,
        (mc.message_id IS NOT NULL) AS completed,
        m.created_at,
        -- Run resource ID (one hop to hydrate)
        rra.runs_id,
        -- History content (for LLM context)
        te.content AS history_content,
        -- Audio resource ID
        aa.audio_id
    FROM simulation_messages_entry sm
    JOIN messages_entry m ON m.id = sm.id
    JOIN simulation_chats_entry c ON c.id = sm.chat_id
    JOIN simulation_attempts_entry a ON a.id = c.attempt_id
    LEFT JOIN runs_resource_agg rra ON rra.run_id = m.run_id
    LEFT JOIN texts_entry te ON te.id = m.text_id
    LEFT JOIN audio_agg aa ON aa.message_id = sm.id
    -- Latest message completion state (append-only)
    LEFT JOIN LATERAL (
        SELECT message_id FROM messages_completions_entry
        WHERE message_id = m.id AND active = TRUE ORDER BY created_at DESC LIMIT 1
    ) mc ON true
    -- Latest archive state (append-only)
    LEFT JOIN LATERAL (
        SELECT archived FROM simulation_archives_entry
        WHERE attempt_id = a.id AND active = TRUE ORDER BY created_at DESC LIMIT 1
    ) sa_archive ON true
    WHERE m.active = TRUE
      AND c.active = TRUE
      AND a.active = TRUE
      AND COALESCE(sa_archive.archived, FALSE) = FALSE
      AND m.role IN ('user'::message_type, 'assistant'::message_type)
)
SELECT
    -- Primary key
    bm.message_id,

    -- Foreign keys for parallel lookup and grouping
    bm.chat_id,
    bm.attempt_id,

    -- Message data (position derived in service layer)
    CASE WHEN bm.role = 'user'::message_type THEN 'query' ELSE 'response' END AS type,
    bm.created_at,
    bm.completed,

    -- Run resource ID (one hop to hydrate)
    bm.runs_id,

    -- History content (for LLM context)
    bm.history_content,

    -- Audio resource ID
    bm.audio_id

FROM base_messages bm
WITH NO DATA;

-- ============================================================================
-- Step 4: Create Unique Index (Required for CONCURRENT refresh)
-- ============================================================================

CREATE UNIQUE INDEX mv_attempt_messages_pk
    ON mv_attempt_messages (message_id);

-- ============================================================================
-- Step 5: Create Filter/Slicing Indexes
-- ============================================================================

-- Chat ID for grouping
CREATE INDEX mv_attempt_messages_chat_id_idx
    ON mv_attempt_messages (chat_id);

-- Attempt ID for parallel lookup
CREATE INDEX mv_attempt_messages_attempt_id_idx
    ON mv_attempt_messages (attempt_id);

-- Composite: attempt + chat for ordering (position derived in service layer)
CREATE INDEX mv_attempt_messages_attempt_chat_idx
    ON mv_attempt_messages (attempt_id, chat_id);

-- Message type for filtering
CREATE INDEX mv_attempt_messages_type_idx
    ON mv_attempt_messages (type);

-- Created at for ordering (position derived from this)
CREATE INDEX mv_attempt_messages_created_at_idx
    ON mv_attempt_messages (created_at);

-- Runs ID for filtering by run
CREATE INDEX mv_attempt_messages_runs_id_idx
    ON mv_attempt_messages (runs_id)
    WHERE runs_id IS NOT NULL;

-- ============================================================================
-- Step 6: Refresh Materialized View with Data
-- ============================================================================

REFRESH MATERIALIZED VIEW mv_attempt_messages;
