-- Materialized View: mv_benchmark_feedbacks
-- Grain: One row per benchmark feedback entry per grade
--
-- Purpose: Flat denormalized feedback rows for benchmark grades,
-- replacing the feedbacks_agg composite array in mv_benchmark_invocations.
--
-- Dependencies: benchmark_feedbacks_entry
-- ============================================================================

-- ============================================================================
-- Step 1: Drop all indexes on mv_benchmark_feedbacks (if it exists)
-- ============================================================================

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT indexname
        FROM pg_indexes
        WHERE schemaname = 'public'
          AND tablename = 'mv_benchmark_feedbacks'
    LOOP
        EXECUTE format('DROP INDEX IF EXISTS %I', r.indexname);
    END LOOP;
END $$;

-- ============================================================================
-- Step 2: Drop materialized view if it exists
-- ============================================================================

DROP MATERIALIZED VIEW IF EXISTS mv_benchmark_feedbacks CASCADE;

-- ============================================================================
-- Step 3: Create mv_benchmark_feedbacks Materialized View
-- ============================================================================

CREATE MATERIALIZED VIEW mv_benchmark_feedbacks AS
SELECT
    fe.id AS feedback_id,
    fe.grade_id,
    fe.total,
    fe.feedback,
    fe.total_points,
    fe.pass_points,
    fe.created_at
FROM benchmark_feedbacks_entry fe
WHERE fe.active = TRUE
WITH NO DATA;

-- ============================================================================
-- Step 4: Create Unique Index (Required for CONCURRENT refresh)
-- ============================================================================

CREATE UNIQUE INDEX mv_benchmark_feedbacks_pk
    ON mv_benchmark_feedbacks (feedback_id);

-- ============================================================================
-- Step 5: Create Filter/Slicing Indexes
-- ============================================================================

CREATE INDEX mv_benchmark_feedbacks_grade_id_idx
    ON mv_benchmark_feedbacks (grade_id);

CREATE INDEX mv_benchmark_feedbacks_grade_id_created_at_idx
    ON mv_benchmark_feedbacks (grade_id, created_at);

-- ============================================================================
-- Step 6: Refresh Materialized View with Data
-- ============================================================================

REFRESH MATERIALIZED VIEW mv_benchmark_feedbacks;
