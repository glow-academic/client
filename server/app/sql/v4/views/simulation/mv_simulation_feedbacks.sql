-- Materialized View: mv_attempt_feedbacks
-- Grain: One row per feedback entry per grade
--
-- Purpose: Flat denormalized feedback rows for simulation grades,
-- replacing the feedbacks_agg composite array in mv_attempt_chats.
--
-- Dependencies: attempt_feedback_entry, feedbacks_standards_connection
-- ============================================================================

-- ============================================================================
-- Step 1: Drop all indexes on mv_attempt_feedbacks (if it exists)
-- ============================================================================

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT indexname
        FROM pg_indexes
        WHERE schemaname = 'public'
          AND tablename = 'mv_attempt_feedbacks'
    LOOP
        EXECUTE format('DROP INDEX IF EXISTS %I', r.indexname);
    END LOOP;
END $$;

-- ============================================================================
-- Step 2: Drop materialized view if it exists
-- ============================================================================

DROP MATERIALIZED VIEW IF EXISTS mv_attempt_feedbacks CASCADE;

-- ============================================================================
-- Step 3: Create mv_attempt_feedbacks Materialized View
-- ============================================================================

CREATE MATERIALIZED VIEW mv_attempt_feedbacks AS
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

CREATE UNIQUE INDEX mv_attempt_feedbacks_pk
    ON mv_attempt_feedbacks (feedback_id);

-- ============================================================================
-- Step 5: Create Filter/Slicing Indexes
-- ============================================================================

CREATE INDEX mv_attempt_feedbacks_grade_id_idx
    ON mv_attempt_feedbacks (grade_id);

CREATE INDEX mv_attempt_feedbacks_grade_id_created_at_idx
    ON mv_attempt_feedbacks (grade_id, created_at);

-- ============================================================================
-- Step 6: Refresh Materialized View with Data
-- ============================================================================

REFRESH MATERIALIZED VIEW mv_attempt_feedbacks;
