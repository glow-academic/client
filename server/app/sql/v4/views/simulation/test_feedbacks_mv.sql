-- Materialized View: test_feedbacks_mv
-- Grain: One row per benchmark feedback entry per grade
--
-- Purpose: Flat denormalized feedback rows for benchmark grades,
-- replacing the feedbacks_agg composite array in test_invocations_mv.
--
-- Dependencies: test_feedback_entry
-- ============================================================================

-- ============================================================================
-- Step 1: Drop all indexes on test_feedbacks_mv (if it exists)
-- ============================================================================

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT indexname
        FROM pg_indexes
        WHERE schemaname = 'public'
          AND tablename = 'test_feedbacks_mv'
    LOOP
        EXECUTE format('DROP INDEX IF EXISTS %I', r.indexname);
    END LOOP;
END $$;

-- ============================================================================
-- Step 2: Drop materialized view if it exists
-- ============================================================================

DROP MATERIALIZED VIEW IF EXISTS test_feedbacks_mv CASCADE;

-- ============================================================================
-- Step 3: Create test_feedbacks_mv Materialized View
-- ============================================================================

CREATE MATERIALIZED VIEW test_feedbacks_mv AS
SELECT
    fe.id AS feedback_id,
    fe.grade_id,
    fe.total,
    fe.feedback,
    fe.total_points,
    fe.pass_points,
    fe.created_at
FROM test_feedback_entry fe
WHERE fe.active = TRUE
WITH NO DATA;

-- ============================================================================
-- Step 4: Create Unique Index (Required for CONCURRENT refresh)
-- ============================================================================

CREATE UNIQUE INDEX test_feedbacks_mv_pk
    ON test_feedbacks_mv (feedback_id);

-- ============================================================================
-- Step 5: Create Filter/Slicing Indexes
-- ============================================================================

CREATE INDEX test_feedbacks_mv_grade_id_idx
    ON test_feedbacks_mv (grade_id);

CREATE INDEX test_feedbacks_mv_grade_id_created_at_idx
    ON test_feedbacks_mv (grade_id, created_at);

-- ============================================================================
-- Step 6: Refresh Materialized View with Data
-- ============================================================================

REFRESH MATERIALIZED VIEW test_feedbacks_mv;
