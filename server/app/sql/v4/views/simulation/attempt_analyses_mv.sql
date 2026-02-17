-- Materialized View: attempt_analyses_mv
-- Grain: One row per analysis entry per grade
--
-- Purpose: Flat denormalized analysis rows for simulation grades,
-- replacing the analyses_agg composite array in attempt_chats_mv.
--
-- Dependencies: attempt_analysis_entry
-- ============================================================================

-- ============================================================================
-- Step 1: Drop all indexes on attempt_analyses_mv (if it exists)
-- ============================================================================

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT indexname
        FROM pg_indexes
        WHERE schemaname = 'public'
          AND tablename = 'attempt_analyses_mv'
    LOOP
        EXECUTE format('DROP INDEX IF EXISTS %I', r.indexname);
    END LOOP;
END $$;

-- ============================================================================
-- Step 2: Drop materialized view if it exists
-- ============================================================================

DROP MATERIALIZED VIEW IF EXISTS attempt_analyses_mv CASCADE;

-- ============================================================================
-- Step 3: Create attempt_analyses_mv Materialized View
-- ============================================================================

CREATE MATERIALIZED VIEW attempt_analyses_mv AS
SELECT
    ae.id AS analysis_id,
    ae.grade_id,
    ae.content,
    ae.created_at
FROM attempt_analysis_entry ae
WITH NO DATA;

-- ============================================================================
-- Step 4: Create Unique Index (Required for CONCURRENT refresh)
-- ============================================================================

CREATE UNIQUE INDEX attempt_analyses_mv_pk
    ON attempt_analyses_mv (analysis_id);

-- ============================================================================
-- Step 5: Create Filter/Slicing Indexes
-- ============================================================================

CREATE INDEX attempt_analyses_mv_grade_id_idx
    ON attempt_analyses_mv (grade_id);

-- ============================================================================
-- Step 6: Refresh Materialized View with Data
-- ============================================================================

REFRESH MATERIALIZED VIEW attempt_analyses_mv;
