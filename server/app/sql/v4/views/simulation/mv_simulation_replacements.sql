-- Materialized View: mv_attempt_replacements
-- Grain: One row per replacement entry per improvement
--
-- Filter: active = TRUE with parent chain filters
-- Purpose: Flat denormalized replacements for parallel fetching
-- Dependencies: Only uses _entry tables
-- ============================================================================
-- Step 1: Drop all indexes on mv_attempt_replacements materialized view (if it exists)
-- ============================================================================

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT indexname
        FROM pg_indexes
        WHERE schemaname = 'public'
          AND tablename = 'mv_attempt_replacements'
    LOOP
        EXECUTE format('DROP INDEX IF EXISTS %I', r.indexname);
    END LOOP;
END $$;

-- ============================================================================
-- Step 2: Drop mv_attempt_replacements materialized view if it exists
-- ============================================================================

DROP MATERIALIZED VIEW IF EXISTS mv_attempt_replacements CASCADE;

-- ============================================================================
-- Step 3: Create mv_attempt_replacements Materialized View
-- ============================================================================

CREATE MATERIALIZED VIEW mv_attempt_replacements AS
SELECT
    r.id AS replacement_id,
    r.improvement_id,
    r.section,
    r.replace AS replace_text,
    r.idx,
    r.created_at
FROM attempt_replacement_entry r
JOIN attempt_improvement_entry i ON i.id = r.improvement_id
JOIN attempt_message_entry sm ON sm.id = i.message_id
JOIN messages_entry m ON m.id = sm.id
JOIN attempt_chat_entry c ON c.id = sm.chat_id
JOIN attempt_entry a ON a.id = c.attempt_id
LEFT JOIN LATERAL (
    SELECT archived FROM attempt_archive_entry
    WHERE attempt_id = a.id AND active = TRUE ORDER BY created_at DESC LIMIT 1
) sa_archive ON true
WHERE r.active = TRUE
  AND i.active = TRUE
  AND m.active = TRUE
  AND c.active = TRUE
  AND a.active = TRUE
  AND COALESCE(sa_archive.archived, FALSE) = FALSE
WITH NO DATA;

-- ============================================================================
-- Step 4: Create Unique Index (Required for CONCURRENT refresh)
-- ============================================================================

CREATE UNIQUE INDEX mv_attempt_replacements_pk
    ON mv_attempt_replacements (replacement_id);

-- ============================================================================
-- Step 5: Create Filter/Slicing Indexes
-- ============================================================================

-- Improvement ID for grouping
CREATE INDEX mv_attempt_replacements_improvement_id_idx
    ON mv_attempt_replacements (improvement_id);

-- Composite: improvement + idx for ordered access
CREATE INDEX mv_attempt_replacements_improvement_idx_idx
    ON mv_attempt_replacements (improvement_id, idx);

-- ============================================================================
-- Step 6: Refresh Materialized View with Data
-- ============================================================================

REFRESH MATERIALIZED VIEW mv_attempt_replacements;
