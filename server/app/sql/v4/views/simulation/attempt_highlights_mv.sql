-- Materialized View: attempt_highlights_mv
-- Grain: One row per highlight entry per strength
--
-- Filter: active = TRUE with parent chain filters
-- Purpose: Flat denormalized highlights for parallel fetching
-- Dependencies: Only uses _entry tables
-- ============================================================================
-- Step 1: Drop all indexes on attempt_highlights_mv materialized view (if it exists)
-- ============================================================================

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT indexname
        FROM pg_indexes
        WHERE schemaname = 'public'
          AND tablename = 'attempt_highlights_mv'
    LOOP
        EXECUTE format('DROP INDEX IF EXISTS %I', r.indexname);
    END LOOP;
END $$;

-- ============================================================================
-- Step 2: Drop attempt_highlights_mv materialized view if it exists
-- ============================================================================

DROP MATERIALIZED VIEW IF EXISTS attempt_highlights_mv CASCADE;

-- ============================================================================
-- Step 3: Create attempt_highlights_mv Materialized View
-- ============================================================================

CREATE MATERIALIZED VIEW attempt_highlights_mv AS
SELECT
    h.id AS highlight_id,
    h.strength_id,
    h.section,
    h.idx,
    h.created_at
FROM attempt_highlight_entry h
JOIN attempt_strength_entry s ON s.id = h.strength_id
JOIN attempt_message_entry sm ON sm.id = s.message_id
JOIN messages_entry m ON m.id = sm.id
JOIN attempt_chat_entry c ON c.id = sm.chat_id
JOIN attempt_entry a ON a.id = c.attempt_id
LEFT JOIN LATERAL (
    SELECT archived FROM attempt_archive_entry
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

CREATE UNIQUE INDEX attempt_highlights_mv_pk
    ON attempt_highlights_mv (highlight_id);

-- ============================================================================
-- Step 5: Create Filter/Slicing Indexes
-- ============================================================================

-- Strength ID for grouping
CREATE INDEX attempt_highlights_mv_strength_id_idx
    ON attempt_highlights_mv (strength_id);

-- Composite: strength + idx for ordered access
CREATE INDEX attempt_highlights_mv_strength_idx_idx
    ON attempt_highlights_mv (strength_id, idx);

-- ============================================================================
-- Step 6: Refresh Materialized View with Data
-- ============================================================================

REFRESH MATERIALIZED VIEW attempt_highlights_mv;
