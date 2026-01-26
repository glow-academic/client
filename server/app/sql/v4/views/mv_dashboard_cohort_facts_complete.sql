-- Materialized View: mv_dashboard_cohort_facts
-- Pre-aggregated cohort performance per profile and simulation.
-- Groups by: (cohort_id, profile_id, simulation_id)
-- Uses idempotent drop/recreate pattern - safe to run multiple times.
--
-- IMPORTANT: This MV depends on mv_dashboard_facts.
-- mv_dashboard_facts must be created and refreshed BEFORE this one.
--
-- Key principle: Pre-aggregated for fast cohort leaderboards and member progress.
-- Only includes general attempts (practice has no cohorts).
-- ============================================================================
-- Step 1: Drop all indexes on mv_dashboard_cohort_facts materialized view (if it exists)
-- ============================================================================

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT indexname
        FROM pg_indexes
        WHERE schemaname = 'public'
          AND tablename = 'mv_dashboard_cohort_facts'
    LOOP
        EXECUTE format('DROP INDEX IF EXISTS %I', r.indexname);
    END LOOP;
END $$;

-- ============================================================================
-- Step 2: Drop mv_dashboard_cohort_facts materialized view if it exists
-- ============================================================================

DROP MATERIALIZED VIEW IF EXISTS mv_dashboard_cohort_facts CASCADE;

-- ============================================================================
-- Step 3: Create mv_dashboard_cohort_facts Materialized View
-- ============================================================================

CREATE MATERIALIZED VIEW mv_dashboard_cohort_facts AS
SELECT
    -- Aggregation key
    cohort_id,
    profile_id,
    simulation_id,
    department_id,

    -- Attempt counts
    COUNT(DISTINCT attempt_id)::int AS total_attempts,
    COUNT(DISTINCT attempt_id) FILTER (WHERE passed = TRUE)::int AS passed_attempts,
    COUNT(DISTINCT chat_id)::int AS total_chats,
    COUNT(DISTINCT chat_id) FILTER (WHERE completed = TRUE)::int AS completed_chats,
    COUNT(DISTINCT chat_id) FILTER (WHERE grade_id IS NOT NULL)::int AS graded_chats,

    -- Score aggregates
    MAX(score) FILTER (WHERE score IS NOT NULL)::int AS best_score,
    AVG(score) FILTER (WHERE score IS NOT NULL)::numeric AS avg_score,
    SUM(score) FILTER (WHERE score IS NOT NULL)::bigint AS sum_score,

    -- Time aggregates
    SUM(time_taken) FILTER (WHERE time_taken IS NOT NULL)::bigint AS sum_time_taken,
    AVG(time_taken) FILTER (WHERE time_taken IS NOT NULL)::numeric AS avg_time_taken,

    -- Date bounds for the cohort member
    MIN(attempt_created_at) AS first_attempt_at,
    MAX(attempt_created_at) AS last_attempt_at

FROM mv_dashboard_facts
WHERE cohort_id IS NOT NULL  -- Only general attempts have cohorts
  AND is_archived = FALSE
GROUP BY
    cohort_id,
    profile_id,
    simulation_id,
    department_id
WITH NO DATA;

-- ============================================================================
-- Step 4: Create Unique Index (Required for CONCURRENT refresh)
-- ============================================================================

-- Composite unique key for cohort + profile + simulation
CREATE UNIQUE INDEX mv_dashboard_cohort_facts_pk
    ON mv_dashboard_cohort_facts (
        cohort_id,
        profile_id,
        simulation_id
    );

-- ============================================================================
-- Step 5: Create Filter/Slicing Indexes
-- ============================================================================

-- Primary dimension indexes
CREATE INDEX mv_dashboard_cohort_facts_cohort_id_idx
    ON mv_dashboard_cohort_facts (cohort_id);

CREATE INDEX mv_dashboard_cohort_facts_profile_id_idx
    ON mv_dashboard_cohort_facts (profile_id);

CREATE INDEX mv_dashboard_cohort_facts_simulation_id_idx
    ON mv_dashboard_cohort_facts (simulation_id);

CREATE INDEX mv_dashboard_cohort_facts_department_id_idx
    ON mv_dashboard_cohort_facts (department_id)
    WHERE department_id IS NOT NULL;

-- Composite indexes for common query patterns
CREATE INDEX mv_dashboard_cohort_facts_cohort_sim_idx
    ON mv_dashboard_cohort_facts (cohort_id, simulation_id);

CREATE INDEX mv_dashboard_cohort_facts_cohort_profile_idx
    ON mv_dashboard_cohort_facts (cohort_id, profile_id);

CREATE INDEX mv_dashboard_cohort_facts_sim_profile_idx
    ON mv_dashboard_cohort_facts (simulation_id, profile_id);

CREATE INDEX mv_dashboard_cohort_facts_profile_sim_idx
    ON mv_dashboard_cohort_facts (profile_id, simulation_id);

-- Performance metric indexes for sorting/filtering
CREATE INDEX mv_dashboard_cohort_facts_best_score_idx
    ON mv_dashboard_cohort_facts (best_score DESC NULLS LAST);

CREATE INDEX mv_dashboard_cohort_facts_total_attempts_idx
    ON mv_dashboard_cohort_facts (total_attempts DESC);

CREATE INDEX mv_dashboard_cohort_facts_passed_attempts_idx
    ON mv_dashboard_cohort_facts (passed_attempts DESC);

-- Leaderboard pattern indexes (cohort + simulation + score ranking)
CREATE INDEX mv_dashboard_cohort_facts_cohort_sim_score_idx
    ON mv_dashboard_cohort_facts (cohort_id, simulation_id, best_score DESC NULLS LAST);

-- Date indexes
CREATE INDEX mv_dashboard_cohort_facts_first_attempt_at_idx
    ON mv_dashboard_cohort_facts (first_attempt_at);

CREATE INDEX mv_dashboard_cohort_facts_last_attempt_at_idx
    ON mv_dashboard_cohort_facts (last_attempt_at);

-- ============================================================================
-- Step 6: Refresh Materialized View with Data
-- ============================================================================

REFRESH MATERIALIZED VIEW mv_dashboard_cohort_facts;
