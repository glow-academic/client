-- Materialized View: attempt_feedback_mv
-- Grain: One row per feedback entry per grade
--
-- Purpose: Flat denormalized feedback rows for simulation grades,
-- replacing the feedbacks_agg composite array in attempt_chat_mv.
--
-- Dependencies: attempt_feedback_entry, feedbacks_standards_connection
-- ============================================================================

-- ============================================================================
-- Step 1: Drop all indexes on attempt_feedback_mv (if it exists)
-- ============================================================================

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT indexname
        FROM pg_indexes
        WHERE schemaname = 'public'
          AND tablename = 'attempt_feedback_mv'
    LOOP
        EXECUTE format('DROP INDEX IF EXISTS %I', r.indexname);
    END LOOP;
END $$;

-- ============================================================================
-- Step 2: Drop materialized view if it exists
-- ============================================================================

DROP MATERIALIZED VIEW IF EXISTS attempt_feedback_mv CASCADE;

-- ============================================================================
-- Step 3: Create attempt_feedback_mv Materialized View
-- ============================================================================

CREATE MATERIALIZED VIEW attempt_feedback_mv AS
SELECT
    fe.id AS feedback_id,
    fe.grade_id,
    fsc.standard_id,
    fe.total::float AS total,
    fe.feedback,
    fe.created_at
FROM attempt_feedback_entry fe
LEFT JOIN feedbacks_standards_connection fsc ON fsc.feedbacks_id = fe.id
WHERE fe.active = TRUE
WITH NO DATA;

-- ============================================================================
-- Step 4: Create Unique Index (Required for CONCURRENT refresh)
-- ============================================================================

CREATE UNIQUE INDEX attempt_feedback_mv_pk
    ON attempt_feedback_mv (feedback_id);

-- ============================================================================
-- Step 5: Create Filter/Slicing Indexes
-- ============================================================================

CREATE INDEX attempt_feedback_mv_grade_id_idx
    ON attempt_feedback_mv (grade_id);

CREATE INDEX attempt_feedback_mv_grade_id_created_at_idx
    ON attempt_feedback_mv (grade_id, created_at);

-- ============================================================================
-- Step 6: Refresh Materialized View with Data
-- ============================================================================

REFRESH MATERIALIZED VIEW attempt_feedback_mv;
