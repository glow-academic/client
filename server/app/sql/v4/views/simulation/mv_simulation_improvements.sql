-- Materialized View: mv_attempt_improvements
-- Grain: One row per improvement entry per message
--
-- Filter: active = TRUE with parent chain filters
-- Purpose: Flat denormalized improvements for parallel fetching
-- Dependencies: Only uses _entry tables
-- ============================================================================
-- Step 1: Drop all indexes on mv_attempt_improvements materialized view (if it exists)
-- ============================================================================

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT indexname
        FROM pg_indexes
        WHERE schemaname = 'public'
          AND tablename = 'mv_attempt_improvements'
    LOOP
        EXECUTE format('DROP INDEX IF EXISTS %I', r.indexname);
    END LOOP;
END $$;

-- ============================================================================
-- Step 2: Drop mv_attempt_improvements materialized view if it exists
-- ============================================================================

DROP MATERIALIZED VIEW IF EXISTS mv_attempt_improvements CASCADE;

-- ============================================================================
-- Step 3: Create mv_attempt_improvements Materialized View
-- ============================================================================

CREATE MATERIALIZED VIEW mv_attempt_improvements AS
SELECT
    i.id AS improvement_id,
    i.message_id,
    i.name,
    i.description,
    i.created_at
FROM attempt_improvement_entry i
JOIN attempt_message_entry sm ON sm.id = i.message_id
JOIN messages_entry m ON m.id = sm.id
JOIN attempt_chat_entry c ON c.id = sm.chat_id
JOIN attempt_entry a ON a.id = c.attempt_id
LEFT JOIN LATERAL (
    SELECT archived FROM attempt_archive_entry
    WHERE attempt_id = a.id AND active = TRUE ORDER BY created_at DESC LIMIT 1
) sa_archive ON true
WHERE i.active = TRUE
  AND m.active = TRUE
  AND c.active = TRUE
  AND a.active = TRUE
  AND COALESCE(sa_archive.archived, FALSE) = FALSE
WITH NO DATA;

-- ============================================================================
-- Step 4: Create Unique Index (Required for CONCURRENT refresh)
-- ============================================================================

CREATE UNIQUE INDEX mv_attempt_improvements_pk
    ON mv_attempt_improvements (improvement_id);

-- ============================================================================
-- Step 5: Create Filter/Slicing Indexes
-- ============================================================================

-- Message ID for grouping
CREATE INDEX mv_attempt_improvements_message_id_idx
    ON mv_attempt_improvements (message_id);

-- Composite: message + created_at for ordering
CREATE INDEX mv_attempt_improvements_message_created_at_idx
    ON mv_attempt_improvements (message_id, created_at);

-- ============================================================================
-- Step 6: Refresh Materialized View with Data
-- ============================================================================

REFRESH MATERIALIZED VIEW mv_attempt_improvements;
