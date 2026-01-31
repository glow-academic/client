-- Materialized View: mv_practice_simulation_status
-- Overview aggregation for PRACTICE section - simulation cards showing status.
--
-- Grain: One row per (profile_id, simulation_id)
-- Purpose: Practice overview page - simulation cards showing status
--
-- Section: PRACTICE
-- Source: Aggregate from mv_practice_chat_facts
--
-- Note: Practice does not use cohort_id in the grain (unlike Home)
-- ============================================================================
-- Step 1: Drop all indexes on mv_practice_simulation_status materialized view (if it exists)
-- ============================================================================

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT indexname
        FROM pg_indexes
        WHERE schemaname = 'public'
          AND tablename = 'mv_practice_simulation_status'
    LOOP
        EXECUTE format('DROP INDEX IF EXISTS %I', r.indexname);
    END LOOP;
END $$;

-- ============================================================================
-- Step 2: Drop mv_practice_simulation_status materialized view if it exists
-- ============================================================================

DROP MATERIALIZED VIEW IF EXISTS mv_practice_simulation_status CASCADE;

-- ============================================================================
-- Step 3: Create mv_practice_simulation_status Materialized View
-- ============================================================================

CREATE MATERIALIZED VIEW mv_practice_simulation_status AS
SELECT
    -- Keys
    profile_id,
    simulation_id,

    -- Aggregated metrics
    COUNT(DISTINCT attempt_id)::int AS attempt_count,
    COUNT(DISTINCT attempt_id) FILTER (WHERE completed = TRUE)::int AS completed_count,
    MAX(grade_percent) AS highest_score,
    BOOL_OR(passed) AS has_passed,
    MIN(attempt_created_at) AS first_attempt_at,
    MAX(attempt_created_at) AS last_attempt_at,

    -- Rubric points (for pass_pct computation in Python)
    MAX(rubric_total_points)::int AS rubric_total_points,
    MAX(rubric_pass_points)::int AS rubric_pass_points

FROM mv_practice_chat_facts
WHERE is_archived = FALSE  -- Exclude archived practice attempts
GROUP BY profile_id, simulation_id
WITH NO DATA;

-- ============================================================================
-- Step 4: Create Unique Index (Required for CONCURRENT refresh)
-- ============================================================================

CREATE UNIQUE INDEX mv_practice_simulation_status_pk
    ON mv_practice_simulation_status (profile_id, simulation_id);

-- ============================================================================
-- Step 5: Create Filter/Slicing Indexes
-- ============================================================================

-- Primary lookup: profile's simulations
CREATE INDEX mv_practice_simulation_status_profile_id_idx
    ON mv_practice_simulation_status (profile_id);

-- Secondary lookup: simulation across profiles
CREATE INDEX mv_practice_simulation_status_simulation_id_idx
    ON mv_practice_simulation_status (simulation_id);

-- Score-based sorting
CREATE INDEX mv_practice_simulation_status_highest_score_idx
    ON mv_practice_simulation_status (highest_score DESC NULLS LAST)
    WHERE highest_score IS NOT NULL;

-- Time-based sorting
CREATE INDEX mv_practice_simulation_status_last_attempt_idx
    ON mv_practice_simulation_status (last_attempt_at DESC);

-- ============================================================================
-- Step 6: Refresh Materialized View with Data
-- ============================================================================

REFRESH MATERIALIZED VIEW mv_practice_simulation_status;
