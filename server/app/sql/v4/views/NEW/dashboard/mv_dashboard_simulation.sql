-- Materialized View: mv_dashboard_simulation
-- Simulation/Scenario performance aggregation for DASHBOARD section.
--
-- Grain: One row per (simulation_id, scenario_id, cohort_id)
-- Purpose: Simulation and scenario performance breakdown
--
-- Section: DASHBOARD
-- Source: Aggregate from mv_dashboard_chat_facts
--
-- ============================================================================
-- Step 1: Drop all indexes on mv_dashboard_simulation materialized view (if it exists)
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
-- Step 2: Drop mv_dashboard_simulation materialized view if it exists
-- ============================================================================

DROP MATERIALIZED VIEW IF EXISTS mv_dashboard_simulation CASCADE;

-- ============================================================================
-- Step 3: Create mv_dashboard_simulation Materialized View
-- ============================================================================

CREATE MATERIALIZED VIEW mv_dashboard_simulation AS
SELECT
    -- Keys
    simulation_id,
    scenario_id,
    cohort_id,

    -- Aggregated metrics
    COUNT(DISTINCT attempt_id)::int AS attempt_count,
    TRUNC(AVG(grade_percent), 2) AS avg_score,
    TRUNC(
        (COUNT(*) FILTER (WHERE passed = TRUE)::numeric / NULLIF(COUNT(*), 0)) * 100.0,
        2
    ) AS pass_rate,
    TRUNC(AVG(COALESCE(time_taken, 0)), 0)::int AS avg_time_seconds

FROM mv_dashboard_chat_facts
WHERE is_archived = FALSE  -- Exclude archived
GROUP BY simulation_id, scenario_id, cohort_id
WITH NO DATA;

-- ============================================================================
-- Step 4: Create Unique Index (Required for CONCURRENT refresh)
-- ============================================================================

CREATE UNIQUE INDEX mv_dashboard_simulation_pk
    ON mv_dashboard_simulation (
        simulation_id,
        scenario_id,
        COALESCE(cohort_id, '00000000-0000-0000-0000-000000000000'::uuid)
    );

-- ============================================================================
-- Step 5: Create Filter/Slicing Indexes
-- ============================================================================

-- Primary lookup: simulation
CREATE INDEX mv_dashboard_simulation_simulation_id_idx
    ON mv_dashboard_simulation (simulation_id);

-- Scenario filtering
CREATE INDEX mv_dashboard_simulation_scenario_id_idx
    ON mv_dashboard_simulation (scenario_id);

-- Cohort filtering
CREATE INDEX mv_dashboard_simulation_cohort_id_idx
    ON mv_dashboard_simulation (cohort_id)
    WHERE cohort_id IS NOT NULL;

-- Composite: simulation + scenario for breakdown queries
CREATE INDEX mv_dashboard_simulation_sim_scenario_idx
    ON mv_dashboard_simulation (simulation_id, scenario_id);

-- Composite: cohort + simulation for admin queries
CREATE INDEX mv_dashboard_simulation_cohort_simulation_idx
    ON mv_dashboard_simulation (cohort_id, simulation_id)
    WHERE cohort_id IS NOT NULL;

-- Score-based sorting
CREATE INDEX mv_dashboard_simulation_avg_score_idx
    ON mv_dashboard_simulation (avg_score DESC NULLS LAST)
    WHERE avg_score IS NOT NULL;

-- Pass rate sorting
CREATE INDEX mv_dashboard_simulation_pass_rate_idx
    ON mv_dashboard_simulation (pass_rate DESC NULLS LAST)
    WHERE pass_rate IS NOT NULL;

-- Attempt count sorting
CREATE INDEX mv_dashboard_simulation_attempt_count_idx
    ON mv_dashboard_simulation (attempt_count DESC);

-- ============================================================================
-- Step 6: Refresh Materialized View with Data
-- ============================================================================

REFRESH MATERIALIZED VIEW mv_dashboard_simulation;
