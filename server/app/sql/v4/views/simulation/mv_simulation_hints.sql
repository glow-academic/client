-- Materialized View: mv_attempt_hints
-- Grain: One row per hint entry per message
--
-- Filter: active = TRUE with parent chain filters
-- Purpose: Flat denormalized hints for parallel fetching
-- Dependencies: Only uses _entry tables
-- ============================================================================
-- Step 1: Drop all indexes on mv_attempt_hints materialized view (if it exists)
-- ============================================================================

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT indexname
        FROM pg_indexes
        WHERE schemaname = 'public'
          AND tablename = 'mv_attempt_hints'
    LOOP
        EXECUTE format('DROP INDEX IF EXISTS %I', r.indexname);
    END LOOP;
END $$;

-- ============================================================================
-- Step 2: Drop mv_attempt_hints materialized view if it exists
-- ============================================================================

DROP MATERIALIZED VIEW IF EXISTS mv_attempt_hints CASCADE;

-- ============================================================================
-- Step 3: Create mv_attempt_hints Materialized View
-- ============================================================================

CREATE MATERIALIZED VIEW mv_attempt_hints AS
SELECT
    h.id AS hint_id,
    h.message_id,
    h.hint,
    (ROW_NUMBER() OVER (PARTITION BY h.message_id ORDER BY h.created_at) - 1)::int AS idx,
    h.created_at
FROM attempt_hint_entry h
JOIN attempt_message_entry sm ON sm.id = h.message_id
JOIN messages_entry m ON m.id = sm.id
JOIN attempt_chat_entry c ON c.id = sm.chat_id
JOIN attempt_entry a ON a.id = c.attempt_id
LEFT JOIN LATERAL (
    SELECT archived FROM attempt_archive_entry
    WHERE attempt_id = a.id AND active = TRUE ORDER BY created_at DESC LIMIT 1
) sa_archive ON true
WHERE h.active = TRUE
  AND m.active = TRUE
  AND c.active = TRUE
  AND a.active = TRUE
  AND COALESCE(sa_archive.archived, FALSE) = FALSE
WITH NO DATA;

-- ============================================================================
-- Step 4: Create Unique Index (Required for CONCURRENT refresh)
-- ============================================================================

CREATE UNIQUE INDEX mv_attempt_hints_pk
    ON mv_attempt_hints (hint_id);

-- ============================================================================
-- Step 5: Create Filter/Slicing Indexes
-- ============================================================================

-- Message ID for grouping
CREATE INDEX mv_attempt_hints_message_id_idx
    ON mv_attempt_hints (message_id);

-- Composite: message + idx for ordered access
CREATE INDEX mv_attempt_hints_message_idx_idx
    ON mv_attempt_hints (message_id, idx);

-- ============================================================================
-- Step 6: Refresh Materialized View with Data
-- ============================================================================

REFRESH MATERIALIZED VIEW mv_attempt_hints;
