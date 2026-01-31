-- Materialized View: mv_home_simulation_status
-- Pre-aggregates simulation status for the Home page.
--
-- Grain: One row per (profile_id, simulation_id) for general attempts
-- Purpose: Home page shows each simulation's status for a user (not-started / in-progress / passed)
--
-- Source: Aggregates from mv_chat_facts WHERE attempt_type = 'general' AND NOT is_archived
-- ============================================================================
-- Step 1: Drop all indexes (if exists)
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
-- Step 2: Drop materialized view if exists
-- ============================================================================

DROP MATERIALIZED VIEW IF EXISTS mv_home_simulation_status CASCADE;

-- ============================================================================
-- Step 3: Create Materialized View
-- ============================================================================

CREATE MATERIALIZED VIEW mv_home_simulation_status AS
SELECT
    -- Keys
    profile_id,
    simulation_id,
    cohort_id,

    -- Pre-aggregated metrics
    COUNT(*)::int AS attempt_count,
    COUNT(*) FILTER (WHERE completed = TRUE)::int AS completed_count,
    MAX(grade_percent) AS highest_score,
    BOOL_OR(passed = TRUE) AS has_passed,
    MIN(attempt_created_at) AS first_attempt_at,
    MAX(attempt_created_at) AS last_attempt_at,

    -- Status calculation
    CASE
        WHEN BOOL_OR(passed = TRUE) THEN 'passed'
        WHEN COUNT(*) > 0 THEN 'in-progress'
        ELSE 'not-started'
    END::text AS status

FROM mv_chat_facts
WHERE attempt_type = 'general'
  AND is_archived = FALSE
GROUP BY profile_id, simulation_id, cohort_id
WITH NO DATA;

-- ============================================================================
-- Step 4: Create Unique Index (Required for CONCURRENT refresh)
-- ============================================================================

CREATE UNIQUE INDEX mv_home_simulation_status_pk
    ON mv_home_simulation_status (profile_id, simulation_id, cohort_id);

-- ============================================================================
-- Step 5: Create Filter/Slicing Indexes
-- ============================================================================

-- Primary access pattern: profile lookup
CREATE INDEX mv_home_simulation_status_profile_id_idx
    ON mv_home_simulation_status (profile_id);

-- Simulation filter
CREATE INDEX mv_home_simulation_status_simulation_id_idx
    ON mv_home_simulation_status (simulation_id);

-- Cohort filter
CREATE INDEX mv_home_simulation_status_cohort_id_idx
    ON mv_home_simulation_status (cohort_id)
    WHERE cohort_id IS NOT NULL;

-- Status filter
CREATE INDEX mv_home_simulation_status_status_idx
    ON mv_home_simulation_status (status);

-- Profile + status composite
CREATE INDEX mv_home_simulation_status_profile_status_idx
    ON mv_home_simulation_status (profile_id, status);

-- Has passed filter
CREATE INDEX mv_home_simulation_status_has_passed_idx
    ON mv_home_simulation_status (has_passed)
    WHERE has_passed = TRUE;

-- ============================================================================
-- Step 6: Refresh Materialized View with Data
-- ============================================================================

REFRESH MATERIALIZED VIEW mv_home_simulation_status;
