-- Materialized View: mv_simulation_grades
-- Grain: One row per chat (latest grade only, using DISTINCT ON)
--
-- Purpose: Flat denormalized latest grade per chat for simulation attempts,
-- replacing the latest_grade + legacy_rubric CTEs in mv_attempt_chats.
--
-- Dependencies: simulation_grades_entry, simulation_grades_rubrics_connection
-- ============================================================================

-- ============================================================================
-- Step 1: Drop all indexes on mv_simulation_grades (if it exists)
-- ============================================================================

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT indexname
        FROM pg_indexes
        WHERE schemaname = 'public'
          AND tablename = 'mv_simulation_grades'
    LOOP
        EXECUTE format('DROP INDEX IF EXISTS %I', r.indexname);
    END LOOP;
END $$;

-- ============================================================================
-- Step 2: Drop materialized view if it exists
-- ============================================================================

DROP MATERIALIZED VIEW IF EXISTS mv_simulation_grades CASCADE;

-- ============================================================================
-- Step 3: Create mv_simulation_grades Materialized View
-- ============================================================================

CREATE MATERIALIZED VIEW mv_simulation_grades AS
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
    FROM simulation_grades_entry g
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
LEFT JOIN simulation_grades_rubrics_connection grc ON grc.grade_id = lg.grade_id
WITH NO DATA;

-- ============================================================================
-- Step 4: Create Unique Index (Required for CONCURRENT refresh)
-- ============================================================================

CREATE UNIQUE INDEX mv_simulation_grades_pk
    ON mv_simulation_grades (grade_id);

-- ============================================================================
-- Step 5: Create Filter/Slicing Indexes
-- ============================================================================

CREATE UNIQUE INDEX mv_simulation_grades_chat_id_uniq
    ON mv_simulation_grades (chat_id);

CREATE INDEX mv_simulation_grades_chat_id_idx
    ON mv_simulation_grades (chat_id);

-- ============================================================================
-- Step 6: Refresh Materialized View with Data
-- ============================================================================

REFRESH MATERIALIZED VIEW mv_simulation_grades;
