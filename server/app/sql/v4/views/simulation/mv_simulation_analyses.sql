-- Materialized View: mv_simulation_analyses
-- Grain: One row per analysis entry per grade
--
-- Purpose: Flat denormalized analysis rows for simulation grades,
-- replacing the analyses_agg composite array in mv_attempt_chats.
--
-- Dependencies: simulation_analyses_entry
-- ============================================================================

-- ============================================================================
-- Step 1: Drop all indexes on mv_simulation_analyses (if it exists)
-- ============================================================================

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT indexname
        FROM pg_indexes
        WHERE schemaname = 'public'
          AND tablename = 'mv_simulation_analyses'
    LOOP
        EXECUTE format('DROP INDEX IF EXISTS %I', r.indexname);
    END LOOP;
END $$;

-- ============================================================================
-- Step 2: Drop materialized view if it exists
-- ============================================================================

DROP MATERIALIZED VIEW IF EXISTS mv_simulation_analyses CASCADE;

-- ============================================================================
-- Step 3: Create mv_simulation_analyses Materialized View
-- ============================================================================

CREATE MATERIALIZED VIEW mv_simulation_analyses AS
SELECT
    ae.id AS analysis_id,
    ae.grade_id,
    ae.content,
    ae.created_at
FROM simulation_analyses_entry ae
WITH NO DATA;

-- ============================================================================
-- Step 4: Create Unique Index (Required for CONCURRENT refresh)
-- ============================================================================

CREATE UNIQUE INDEX mv_simulation_analyses_pk
    ON mv_simulation_analyses (analysis_id);

-- ============================================================================
-- Step 5: Create Filter/Slicing Indexes
-- ============================================================================

CREATE INDEX mv_simulation_analyses_grade_id_idx
    ON mv_simulation_analyses (grade_id);

-- ============================================================================
-- Step 6: Refresh Materialized View with Data
-- ============================================================================

REFRESH MATERIALIZED VIEW mv_simulation_analyses;
