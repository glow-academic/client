-- Materialized View: mv_simulation_highlights
-- Grain: One row per highlight entry per strength
--
-- Filter: active = TRUE with parent chain filters
-- Purpose: Flat denormalized highlights for parallel fetching
-- Dependencies: Only uses _entry tables
-- ============================================================================
-- Step 1: Drop all indexes on mv_simulation_highlights materialized view (if it exists)
-- ============================================================================

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT indexname
        FROM pg_indexes
        WHERE schemaname = 'public'
          AND tablename = 'mv_simulation_highlights'
    LOOP
        EXECUTE format('DROP INDEX IF EXISTS %I', r.indexname);
    END LOOP;
END $$;

-- ============================================================================
-- Step 2: Drop mv_simulation_highlights materialized view if it exists
-- ============================================================================

DROP MATERIALIZED VIEW IF EXISTS mv_simulation_highlights CASCADE;

-- ============================================================================
-- Step 3: Create mv_simulation_highlights Materialized View
-- ============================================================================

CREATE MATERIALIZED VIEW mv_simulation_highlights AS
SELECT
    h.id AS highlight_id,
    h.strength_id,
    h.section,
    h.idx,
    h.created_at
FROM simulation_highlights_entry h
JOIN simulation_strengths_entry s ON s.id = h.strength_id
JOIN simulation_messages_entry sm ON sm.id = s.message_id
JOIN messages_entry m ON m.id = sm.id
JOIN simulation_chats_entry c ON c.id = sm.chat_id
JOIN simulation_attempts_entry a ON a.id = c.attempt_id
LEFT JOIN LATERAL (
    SELECT archived FROM simulation_archives_entry
    WHERE attempt_id = a.id AND active = TRUE ORDER BY created_at DESC LIMIT 1
) sa_archive ON true
WHERE h.active = TRUE
  AND s.active = TRUE
  AND m.active = TRUE
  AND c.active = TRUE
  AND a.active = TRUE
  AND COALESCE(sa_archive.archived, FALSE) = FALSE
WITH NO DATA;

-- ============================================================================
-- Step 4: Create Unique Index (Required for CONCURRENT refresh)
-- ============================================================================

CREATE UNIQUE INDEX mv_simulation_highlights_pk
    ON mv_simulation_highlights (highlight_id);

-- ============================================================================
-- Step 5: Create Filter/Slicing Indexes
-- ============================================================================

-- Strength ID for grouping
CREATE INDEX mv_simulation_highlights_strength_id_idx
    ON mv_simulation_highlights (strength_id);

-- Composite: strength + idx for ordered access
CREATE INDEX mv_simulation_highlights_strength_idx_idx
    ON mv_simulation_highlights (strength_id, idx);

-- ============================================================================
-- Step 6: Refresh Materialized View with Data
-- ============================================================================

REFRESH MATERIALIZED VIEW mv_simulation_highlights;
