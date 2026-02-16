-- Materialized View: mv_simulation_responses
-- Grain: One row per response entry per chat
--
-- Purpose: Flat denormalized response rows for simulation chats,
-- replacing the responses_agg composite array in mv_attempt_chats.
--
-- Dependencies: responses_entry, responses_questions_connection,
--               responses_options_connection
-- ============================================================================

-- ============================================================================
-- Step 1: Drop all indexes on mv_simulation_responses (if it exists)
-- ============================================================================

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT indexname
        FROM pg_indexes
        WHERE schemaname = 'public'
          AND tablename = 'mv_simulation_responses'
    LOOP
        EXECUTE format('DROP INDEX IF EXISTS %I', r.indexname);
    END LOOP;
END $$;

-- ============================================================================
-- Step 2: Drop materialized view if it exists
-- ============================================================================

DROP MATERIALIZED VIEW IF EXISTS mv_simulation_responses CASCADE;

-- ============================================================================
-- Step 3: Create mv_simulation_responses Materialized View
-- ============================================================================

CREATE MATERIALIZED VIEW mv_simulation_responses AS
SELECT DISTINCT ON (r.id)
    r.id AS response_id,
    r.chat_id,
    rqc.question_id,
    roc.option_id,
    r.completed,
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

CREATE UNIQUE INDEX mv_simulation_responses_pk
    ON mv_simulation_responses (response_id);

-- ============================================================================
-- Step 5: Create Filter/Slicing Indexes
-- ============================================================================

CREATE INDEX mv_simulation_responses_chat_id_idx
    ON mv_simulation_responses (chat_id);

CREATE INDEX mv_simulation_responses_chat_id_created_at_idx
    ON mv_simulation_responses (chat_id, created_at);

-- ============================================================================
-- Step 6: Refresh Materialized View with Data
-- ============================================================================

REFRESH MATERIALIZED VIEW mv_simulation_responses;
