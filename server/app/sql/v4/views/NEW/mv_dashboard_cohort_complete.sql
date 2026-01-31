-- Materialized View: mv_dashboard_cohort
-- Pre-aggregates cohort performance metrics for Dashboard.
--
-- Grain: One row per (cohort_id, simulation_id)
-- Purpose: Dashboard cohort performance chart
--
-- Source: Aggregates from mv_chat_facts grouped by cohort + simulation
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
          AND tablename = 'mv_dashboard_cohort'
    LOOP
        EXECUTE format('DROP INDEX IF EXISTS %I', r.indexname);
    END LOOP;
END $$;

-- ============================================================================
-- Step 2: Drop materialized view if exists
-- ============================================================================

DROP MATERIALIZED VIEW IF EXISTS mv_dashboard_cohort CASCADE;

-- ============================================================================
-- Step 3: Create Materialized View
-- ============================================================================

CREATE MATERIALIZED VIEW mv_dashboard_cohort AS
WITH profile_best AS (
    -- Get best result per profile+simulation+cohort
    SELECT
        profile_id,
        cohort_id,
        simulation_id,
        MAX(grade_percent) AS best_score,
        BOOL_OR(passed = TRUE) AS has_passed,
        COUNT(*) > 0 AS has_attempted
    FROM mv_chat_facts
    WHERE attempt_type = 'general'
      AND is_archived = FALSE
      AND cohort_id IS NOT NULL
    GROUP BY profile_id, cohort_id, simulation_id
)
SELECT
    -- Keys
    cohort_id,
    simulation_id,

    -- Aggregated metrics
    COUNT(DISTINCT profile_id)::int AS total_profiles,
    COUNT(*) FILTER (WHERE has_passed = TRUE)::int AS passed_count,
    COUNT(*) FILTER (WHERE has_attempted = TRUE AND has_passed = FALSE)::int AS in_progress_count,
    -- Not started count requires knowing total expected profiles, handled at query time
    0::int AS not_started_count,
    ROUND(AVG(best_score), 2) AS avg_score,
    ROUND(
        CASE
            WHEN COUNT(*) > 0
            THEN (COUNT(*) FILTER (WHERE has_passed = TRUE)::numeric / COUNT(*)) * 100
            ELSE 0
        END,
    2) AS pass_rate

FROM profile_best
GROUP BY cohort_id, simulation_id
WITH NO DATA;

-- ============================================================================
-- Step 4: Create Unique Index (Required for CONCURRENT refresh)
-- ============================================================================

CREATE UNIQUE INDEX mv_dashboard_cohort_pk
    ON mv_dashboard_cohort (cohort_id, simulation_id);

-- ============================================================================
-- Step 5: Create Filter/Slicing Indexes
-- ============================================================================

-- Primary access pattern: cohort lookup
CREATE INDEX mv_dashboard_cohort_cohort_id_idx
    ON mv_dashboard_cohort (cohort_id);

-- Simulation filter
CREATE INDEX mv_dashboard_cohort_simulation_id_idx
    ON mv_dashboard_cohort (simulation_id);

-- Pass rate ranking
CREATE INDEX mv_dashboard_cohort_pass_rate_idx
    ON mv_dashboard_cohort (pass_rate DESC NULLS LAST);

-- Average score ranking
CREATE INDEX mv_dashboard_cohort_avg_score_idx
    ON mv_dashboard_cohort (avg_score DESC NULLS LAST);

-- ============================================================================
-- Step 6: Refresh Materialized View with Data
-- ============================================================================

REFRESH MATERIALIZED VIEW mv_dashboard_cohort;
