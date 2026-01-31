-- Materialized View: mv_dashboard_simulation
-- Pre-aggregates simulation/scenario performance metrics for Dashboard.
--
-- Grain: One row per (simulation_id, scenario_id, cohort_id)
-- Purpose: Dashboard simulation/scenario performance
--
-- Source: Aggregates from mv_chat_facts grouped by simulation + scenario + cohort
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
          AND tablename = 'mv_dashboard_simulation'
    LOOP
        EXECUTE format('DROP INDEX IF EXISTS %I', r.indexname);
    END LOOP;
END $$;

-- ============================================================================
-- Step 2: Drop materialized view if exists
-- ============================================================================

DROP MATERIALIZED VIEW IF EXISTS mv_dashboard_simulation CASCADE;

-- ============================================================================
-- Step 3: Create Materialized View
-- ============================================================================

CREATE MATERIALIZED VIEW mv_dashboard_simulation AS
SELECT
    -- Keys
    simulation_id,
    scenario_id,
    cohort_id,

    -- Aggregated metrics
    COUNT(*)::int AS attempt_count,
    ROUND(AVG(grade_percent), 2) AS avg_score,
    ROUND(
        CASE
            WHEN COUNT(*) > 0
            THEN (COUNT(*) FILTER (WHERE passed = TRUE)::numeric / COUNT(*)) * 100
            ELSE 0
        END,
    2) AS pass_rate,
    ROUND(AVG(time_taken))::int AS avg_time_seconds

FROM mv_chat_facts
WHERE attempt_type = 'general'
  AND is_archived = FALSE
GROUP BY simulation_id, scenario_id, cohort_id
WITH NO DATA;

-- ============================================================================
-- Step 4: Create Unique Index (Required for CONCURRENT refresh)
-- ============================================================================

CREATE UNIQUE INDEX mv_dashboard_simulation_pk
    ON mv_dashboard_simulation (simulation_id, scenario_id, COALESCE(cohort_id, '00000000-0000-0000-0000-000000000000'::uuid));

-- ============================================================================
-- Step 5: Create Filter/Slicing Indexes
-- ============================================================================

-- Primary access pattern: simulation lookup
CREATE INDEX mv_dashboard_simulation_simulation_id_idx
    ON mv_dashboard_simulation (simulation_id);

-- Scenario filter
CREATE INDEX mv_dashboard_simulation_scenario_id_idx
    ON mv_dashboard_simulation (scenario_id);

-- Cohort filter
CREATE INDEX mv_dashboard_simulation_cohort_id_idx
    ON mv_dashboard_simulation (cohort_id)
    WHERE cohort_id IS NOT NULL;

-- Composite for dashboard queries
CREATE INDEX mv_dashboard_simulation_cohort_simulation_idx
    ON mv_dashboard_simulation (cohort_id, simulation_id)
    WHERE cohort_id IS NOT NULL;

-- Pass rate ranking
CREATE INDEX mv_dashboard_simulation_pass_rate_idx
    ON mv_dashboard_simulation (pass_rate DESC NULLS LAST);

-- Average score ranking
CREATE INDEX mv_dashboard_simulation_avg_score_idx
    ON mv_dashboard_simulation (avg_score DESC NULLS LAST);

-- ============================================================================
-- Step 6: Refresh Materialized View with Data
-- ============================================================================

REFRESH MATERIALIZED VIEW mv_dashboard_simulation;
