-- Materialized View: mv_home_simulation_status
-- Overview aggregation for HOME section - simulation cards showing status.
--
-- Grain: One row per (profile_id, simulation_id, cohort_id)
-- Purpose: Home overview page - simulation cards showing status
--
-- Section: HOME
-- Source: Aggregate from mv_home_chat_facts
--
-- ============================================================================
-- Step 1: Drop all indexes on mv_home_simulation_status materialized view (if it exists)
-- ============================================================================

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT indexname
        FROM pg_indexes
        WHERE schemaname = 'public'
          AND tablename = 'mv_home_simulation_status'
    LOOP
        EXECUTE format('DROP INDEX IF EXISTS %I', r.indexname);
    END LOOP;
END $$;

-- ============================================================================
-- Step 2: Drop mv_home_simulation_status materialized view if it exists
-- ============================================================================

DROP MATERIALIZED VIEW IF EXISTS mv_home_simulation_status CASCADE;

-- ============================================================================
-- Step 3: Create mv_home_simulation_status Materialized View
-- ============================================================================

CREATE MATERIALIZED VIEW mv_home_simulation_status AS
SELECT
    -- Keys
    profile_id,
    simulation_id,
    cohort_id,

    -- Aggregated metrics
    COUNT(DISTINCT attempt_id)::int AS attempt_count,
    COUNT(DISTINCT attempt_id) FILTER (WHERE completed = TRUE)::int AS completed_count,
    MAX(grade_percent) AS highest_score,
    BOOL_OR(passed) AS has_passed,
    MIN(attempt_created_at) AS first_attempt_at,
    MAX(attempt_created_at) AS last_attempt_at,

    -- Computed status
    CASE
        WHEN BOOL_OR(passed) = TRUE THEN 'passed'
        WHEN COUNT(DISTINCT attempt_id) > 0 THEN 'in-progress'
        ELSE 'not-started'
    END AS status

FROM mv_home_chat_facts
GROUP BY profile_id, simulation_id, cohort_id
WITH NO DATA;

-- ============================================================================
-- Step 4: Create Unique Index (Required for CONCURRENT refresh)
-- ============================================================================

CREATE UNIQUE INDEX mv_home_simulation_status_pk
    ON mv_home_simulation_status (profile_id, simulation_id, COALESCE(cohort_id, '00000000-0000-0000-0000-000000000000'::uuid));

-- ============================================================================
-- Step 5: Create Filter/Slicing Indexes
-- ============================================================================

-- Primary lookup: profile's simulations
CREATE INDEX mv_home_simulation_status_profile_id_idx
    ON mv_home_simulation_status (profile_id);

-- Secondary lookup: simulation across profiles
CREATE INDEX mv_home_simulation_status_simulation_id_idx
    ON mv_home_simulation_status (simulation_id);

-- Cohort filtering
CREATE INDEX mv_home_simulation_status_cohort_id_idx
    ON mv_home_simulation_status (cohort_id)
    WHERE cohort_id IS NOT NULL;

-- Status filtering
CREATE INDEX mv_home_simulation_status_status_idx
    ON mv_home_simulation_status (status);

-- Composite: profile + cohort for cohort-scoped queries
CREATE INDEX mv_home_simulation_status_profile_cohort_idx
    ON mv_home_simulation_status (profile_id, cohort_id)
    WHERE cohort_id IS NOT NULL;

-- Composite: cohort + simulation for admin queries
CREATE INDEX mv_home_simulation_status_cohort_simulation_idx
    ON mv_home_simulation_status (cohort_id, simulation_id)
    WHERE cohort_id IS NOT NULL;

-- Score-based sorting
CREATE INDEX mv_home_simulation_status_highest_score_idx
    ON mv_home_simulation_status (highest_score DESC NULLS LAST)
    WHERE highest_score IS NOT NULL;

-- ============================================================================
-- Step 6: Refresh Materialized View with Data
-- ============================================================================

REFRESH MATERIALIZED VIEW mv_home_simulation_status;
