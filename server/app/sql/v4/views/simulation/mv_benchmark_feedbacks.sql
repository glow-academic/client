-- Materialized View: mv_test_feedbacks
-- Grain: One row per benchmark feedback entry per grade
--
-- Purpose: Flat denormalized feedback rows for benchmark grades,
-- replacing the feedbacks_agg composite array in mv_test_invocations.
--
-- Dependencies: test_feedback_entry
-- ============================================================================

-- ============================================================================
-- Step 1: Drop all indexes on mv_test_feedbacks (if it exists)
-- ============================================================================

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT indexname
        FROM pg_indexes
        WHERE schemaname = 'public'
          AND tablename = 'mv_test_feedbacks'
    LOOP
        EXECUTE format('DROP INDEX IF EXISTS %I', r.indexname);
    END LOOP;
END $$;

-- ============================================================================
-- Step 2: Drop materialized view if it exists
-- ============================================================================

DROP MATERIALIZED VIEW IF EXISTS mv_test_feedbacks CASCADE;

-- ============================================================================
-- Step 3: Create mv_test_feedbacks Materialized View
-- ============================================================================

CREATE MATERIALIZED VIEW mv_test_feedbacks AS
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

CREATE UNIQUE INDEX mv_test_feedbacks_pk
    ON mv_test_feedbacks (feedback_id);

-- ============================================================================
-- Step 5: Create Filter/Slicing Indexes
-- ============================================================================

CREATE INDEX mv_test_feedbacks_grade_id_idx
    ON mv_test_feedbacks (grade_id);

CREATE INDEX mv_test_feedbacks_grade_id_created_at_idx
    ON mv_test_feedbacks (grade_id, created_at);

-- ============================================================================
-- Step 6: Refresh Materialized View with Data
-- ============================================================================

REFRESH MATERIALIZED VIEW mv_test_feedbacks;
