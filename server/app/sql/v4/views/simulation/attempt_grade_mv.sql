-- Materialized View: attempt_grade_mv
-- Grain: One row per chat (latest grade only, using DISTINCT ON)
--
-- Purpose: Flat denormalized latest grade per chat for simulation attempts,
-- replacing the latest_grade + legacy_rubric CTEs in attempt_chat_mv.
--
-- Dependencies: attempt_grade_entry, attempt_grade_rubrics_connection
-- ============================================================================

-- ============================================================================
-- Step 1: Drop all indexes on attempt_grade_mv (if it exists)
-- ============================================================================

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT indexname
        FROM pg_indexes
        WHERE schemaname = 'public'
          AND tablename = 'attempt_grade_mv'
    LOOP
        EXECUTE format('DROP INDEX IF EXISTS %I', r.indexname);
    END LOOP;
END $$;

-- ============================================================================
-- Step 2: Drop materialized view if it exists
-- ============================================================================

DROP MATERIALIZED VIEW IF EXISTS attempt_grade_mv CASCADE;

-- ============================================================================
-- Step 3: Create attempt_grade_mv Materialized View
-- ============================================================================

CREATE MATERIALIZED VIEW attempt_grade_mv AS
WITH latest_grade AS (
    SELECT DISTINCT ON (g.chat_id)
        g.id AS grade_id,
        g.chat_id,
        g.score,
        g.passed,
        g.time_taken,
        g.total_points,
        g.pass_points,
        g.created_at
    FROM attempt_grade_entry g
    WHERE g.active = TRUE
    ORDER BY g.chat_id, g.created_at DESC
)
SELECT
    lg.grade_id,
    lg.chat_id,
    lg.score::float AS score,
    lg.passed,
    lg.time_taken,
    lg.total_points,
    lg.pass_points,
    grc.rubrics_id AS rubric_id,
    lg.created_at
FROM latest_grade lg
LEFT JOIN attempt_grade_rubrics_connection grc ON grc.grade_id = lg.grade_id
WITH NO DATA;

-- ============================================================================
-- Step 4: Create Unique Index (Required for CONCURRENT refresh)
-- ============================================================================

CREATE UNIQUE INDEX attempt_grade_mv_pk
    ON attempt_grade_mv (grade_id);

-- ============================================================================
-- Step 5: Create Filter/Slicing Indexes
-- ============================================================================

CREATE UNIQUE INDEX attempt_grade_mv_chat_id_uniq
    ON attempt_grade_mv (chat_id);

CREATE INDEX attempt_grade_mv_chat_id_idx
    ON attempt_grade_mv (chat_id);

-- ============================================================================
-- Step 6: Refresh Materialized View with Data
-- ============================================================================

REFRESH MATERIALIZED VIEW attempt_grade_mv;
