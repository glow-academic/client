-- Materialized View: mv_simulation_strengths
-- Grain: One row per strength entry per message
--
-- Purpose: Flat strength entries for simulation messages
-- Section: SIMULATION (lean MV)
--
-- Dependencies: simulation_strengths_entry, simulation_messages_entry,
--               messages_entry, simulation_chats_entry, simulation_attempts_entry
-- ============================================================================
-- Step 1: Drop all indexes on mv_simulation_strengths materialized view (if it exists)
-- ============================================================================

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT indexname
        FROM pg_indexes
        WHERE schemaname = 'public'
          AND tablename = 'mv_simulation_strengths'
    LOOP
        EXECUTE format('DROP INDEX IF EXISTS %I', r.indexname);
    END LOOP;
END $$;

-- ============================================================================
-- Step 2: Drop mv_simulation_strengths materialized view if it exists
-- ============================================================================

DROP MATERIALIZED VIEW IF EXISTS mv_simulation_strengths CASCADE;

-- ============================================================================
-- Step 3: Create mv_simulation_strengths Materialized View
-- ============================================================================

CREATE MATERIALIZED VIEW mv_simulation_strengths AS
SELECT
    s.id AS strength_id,
    s.message_id,
    s.grade_id,
    s.name,
    s.description,
    s.created_at
FROM simulation_strengths_entry s
JOIN simulation_messages_entry sm ON sm.id = s.message_id
JOIN messages_entry m ON m.id = sm.id
JOIN simulation_chats_entry c ON c.id = sm.chat_id
JOIN simulation_attempts_entry a ON a.id = c.attempt_id
LEFT JOIN LATERAL (
    SELECT archived FROM simulation_archives_entry
    WHERE attempt_id = a.id AND active = TRUE ORDER BY created_at DESC LIMIT 1
) sa_archive ON true
WHERE s.active = TRUE
  AND m.active = TRUE
  AND c.active = TRUE
  AND a.active = TRUE
  AND COALESCE(sa_archive.archived, FALSE) = FALSE
WITH NO DATA;

-- ============================================================================
-- Step 4: Create Unique Index (Required for CONCURRENT refresh)
-- ============================================================================

CREATE UNIQUE INDEX mv_simulation_strengths_pk
    ON mv_simulation_strengths (strength_id);

-- ============================================================================
-- Step 5: Create Filter/Slicing Indexes
-- ============================================================================

-- Message ID for grouping
CREATE INDEX mv_simulation_strengths_message_id_idx
    ON mv_simulation_strengths (message_id);

-- Composite: message + created_at for ordered lookup
CREATE INDEX mv_simulation_strengths_message_created_idx
    ON mv_simulation_strengths (message_id, created_at);

-- ============================================================================
-- Step 6: Refresh Materialized View with Data
-- ============================================================================

REFRESH MATERIALIZED VIEW mv_simulation_strengths;
