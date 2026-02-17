-- Materialized View: mv_simulation_contents
-- Grain: One row per content entry per message
--
-- Purpose: Flat content entries for simulation messages
-- Section: SIMULATION (lean MV)
--
-- Dependencies: simulation_contents_entry, simulation_messages_entry,
--               messages_entry, simulation_chats_entry, simulation_attempts_entry
-- ============================================================================
-- Step 1: Drop all indexes on mv_simulation_contents materialized view (if it exists)
-- ============================================================================

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT indexname
        FROM pg_indexes
        WHERE schemaname = 'public'
          AND tablename = 'mv_simulation_contents'
    LOOP
        EXECUTE format('DROP INDEX IF EXISTS %I', r.indexname);
    END LOOP;
END $$;

-- ============================================================================
-- Step 2: Drop mv_simulation_contents materialized view if it exists
-- ============================================================================

DROP MATERIALIZED VIEW IF EXISTS mv_simulation_contents CASCADE;

-- ============================================================================
-- Step 3: Create mv_simulation_contents Materialized View
-- ============================================================================

CREATE MATERIALIZED VIEW mv_simulation_contents AS
SELECT
    sce.id AS content_id,
    sce.message_id,
    sce.content,
    sce.persona_id,
    (ROW_NUMBER() OVER (PARTITION BY sce.message_id ORDER BY sce.created_at) - 1)::int AS idx,
    sce.created_at
FROM simulation_contents_entry sce
JOIN simulation_messages_entry sm ON sm.id = sce.message_id
JOIN messages_entry m ON m.id = sm.id
JOIN simulation_chats_entry c ON c.id = sm.chat_id
JOIN simulation_attempts_entry a ON a.id = c.attempt_id
LEFT JOIN LATERAL (
    SELECT archived FROM simulation_archives_entry
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

CREATE UNIQUE INDEX mv_simulation_contents_pk
    ON mv_simulation_contents (content_id);

-- ============================================================================
-- Step 5: Create Filter/Slicing Indexes
-- ============================================================================

-- Message ID for grouping
CREATE INDEX mv_simulation_contents_message_id_idx
    ON mv_simulation_contents (message_id);

-- Composite: message + created_at for ordered lookup
CREATE INDEX mv_simulation_contents_message_created_idx
    ON mv_simulation_contents (message_id, created_at);

-- ============================================================================
-- Step 6: Refresh Materialized View with Data
-- ============================================================================

REFRESH MATERIALIZED VIEW mv_simulation_contents;
