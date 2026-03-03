-- Materialized View: responses_mv
-- Grain: One row per response entry per chat
--
-- Purpose: Flat denormalized response rows for simulation chats,
-- replacing the responses_agg composite array in attempt_chat_mv.
--
-- Dependencies: responses_entry, responses_questions_connection,
--               responses_options_connection
-- ============================================================================

-- ============================================================================
-- Step 1: Drop all indexes on responses_mv (if it exists)
-- ============================================================================

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT indexname
        FROM pg_indexes
        WHERE schemaname = 'public'
          AND tablename = 'responses_mv'
    LOOP
        EXECUTE format('DROP INDEX IF EXISTS %I', r.indexname);
    END LOOP;
END $$;

-- ============================================================================
-- Step 2: Drop materialized view if it exists
-- ============================================================================

DROP MATERIALIZED VIEW IF EXISTS responses_mv CASCADE;

-- ============================================================================
-- Step 3: Create responses_mv Materialized View
-- ============================================================================

CREATE MATERIALIZED VIEW responses_mv AS
SELECT DISTINCT ON (r.id)
    r.id AS response_id,
    r.chat_id,
    rqc.question_id,
    roc.option_id,
    r.created_at
FROM responses_entry r
LEFT JOIN responses_questions_connection rqc ON rqc.responses_id = r.id AND rqc.active = TRUE
LEFT JOIN responses_options_connection roc ON roc.responses_id = r.id AND roc.active = TRUE
WHERE r.active = TRUE
ORDER BY r.id, r.created_at DESC
WITH NO DATA;

-- ============================================================================
-- Step 4: Create Unique Index (Required for CONCURRENT refresh)
-- ============================================================================

CREATE UNIQUE INDEX responses_mv_pk
    ON responses_mv (response_id);

-- ============================================================================
-- Step 5: Create Filter/Slicing Indexes
-- ============================================================================

CREATE INDEX responses_mv_chat_id_idx
    ON responses_mv (chat_id);

CREATE INDEX responses_mv_chat_id_created_at_idx
    ON responses_mv (chat_id, created_at);

-- ============================================================================
-- Step 6: Refresh Materialized View with Data
-- ============================================================================

REFRESH MATERIALIZED VIEW responses_mv;
