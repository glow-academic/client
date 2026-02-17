-- Materialized View: mv_attempt_contents
-- Grain: One row per content entry per message
--
-- Purpose: Flat content entries for simulation messages
-- Section: SIMULATION (lean MV)
--
-- Dependencies: attempt_content_entry, attempt_message_entry,
--               messages_entry, attempt_chat_entry, attempt_entry
-- ============================================================================
-- Step 1: Drop all indexes on mv_attempt_contents materialized view (if it exists)
-- ============================================================================

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT indexname
        FROM pg_indexes
        WHERE schemaname = 'public'
          AND tablename = 'mv_attempt_contents'
    LOOP
        EXECUTE format('DROP INDEX IF EXISTS %I', r.indexname);
    END LOOP;
END $$;

-- ============================================================================
-- Step 2: Drop mv_attempt_contents materialized view if it exists
-- ============================================================================

DROP MATERIALIZED VIEW IF EXISTS mv_attempt_contents CASCADE;

-- ============================================================================
-- Step 3: Create mv_attempt_contents Materialized View
-- ============================================================================

CREATE MATERIALIZED VIEW mv_attempt_contents AS
SELECT
    sce.id AS content_id,
    sce.message_id,
    sce.content,
    sce.persona_id,
    (ROW_NUMBER() OVER (PARTITION BY sce.message_id ORDER BY sce.created_at) - 1)::int AS idx,
    sce.created_at
FROM attempt_content_entry sce
JOIN attempt_message_entry sm ON sm.id = sce.message_id
JOIN messages_entry m ON m.id = sm.id
JOIN attempt_chat_entry c ON c.id = sm.chat_id
JOIN attempt_entry a ON a.id = c.attempt_id
LEFT JOIN LATERAL (
    SELECT archived FROM attempt_archive_entry
    WHERE attempt_id = a.id AND active = TRUE ORDER BY created_at DESC LIMIT 1
) sa_archive ON true
WHERE sce.active = TRUE
  AND m.active = TRUE
  AND c.active = TRUE
  AND a.active = TRUE
  AND COALESCE(sa_archive.archived, FALSE) = FALSE
WITH NO DATA;

-- ============================================================================
-- Step 4: Create Unique Index (Required for CONCURRENT refresh)
-- ============================================================================

CREATE UNIQUE INDEX mv_attempt_contents_pk
    ON mv_attempt_contents (content_id);

-- ============================================================================
-- Step 5: Create Filter/Slicing Indexes
-- ============================================================================

-- Message ID for grouping
CREATE INDEX mv_attempt_contents_message_id_idx
    ON mv_attempt_contents (message_id);

-- Composite: message + created_at for ordered lookup
CREATE INDEX mv_attempt_contents_message_created_idx
    ON mv_attempt_contents (message_id, created_at);

-- ============================================================================
-- Step 6: Refresh Materialized View with Data
-- ============================================================================

REFRESH MATERIALIZED VIEW mv_attempt_contents;
