-- Materialized View: mv_dashboard_daily
-- Pre-aggregates daily metrics for Dashboard growth charts / time series.
--
-- Grain: One row per (date, cohort_id, simulation_id)
-- Purpose: Dashboard growth charts / time series
--
-- Source: Aggregates from mv_chat_facts grouped by date + cohort + simulation
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
          AND tablename = 'mv_dashboard_daily'
    LOOP
        EXECUTE format('DROP INDEX IF EXISTS %I', r.indexname);
    END LOOP;
END $$;

-- ============================================================================
-- Step 2: Drop materialized view if exists
-- ============================================================================

DROP MATERIALIZED VIEW IF EXISTS mv_dashboard_daily CASCADE;

-- ============================================================================
-- Step 3: Create Materialized View
-- ============================================================================

CREATE MATERIALIZED VIEW mv_dashboard_daily AS
SELECT
    -- Keys
    (attempt_created_at::date) AS date_key,
    cohort_id,
    simulation_id,

    -- Aggregated metrics
    COUNT(*)::int AS attempt_count,
    COUNT(DISTINCT profile_id)::int AS unique_profiles,
    COUNT(*) FILTER (WHERE completed = TRUE)::int AS completed_count,
    COUNT(*) FILTER (WHERE passed = TRUE)::int AS passed_count,
    ROUND(AVG(grade_percent), 2) AS avg_score,
    SUM(time_taken)::int AS total_time_seconds,
    ROUND(AVG(num_messages_total), 2) AS avg_messages

FROM mv_chat_facts
WHERE attempt_type = 'general'
  AND is_archived = FALSE
GROUP BY (attempt_created_at::date), cohort_id, simulation_id
WITH NO DATA;

-- ============================================================================
-- Step 4: Create Unique Index (Required for CONCURRENT refresh)
-- ============================================================================

CREATE UNIQUE INDEX mv_dashboard_daily_pk
    ON mv_dashboard_daily (date_key, COALESCE(cohort_id, '00000000-0000-0000-0000-000000000000'::uuid), simulation_id);

-- ============================================================================
-- Step 5: Create Filter/Slicing Indexes
-- ============================================================================

-- Primary access pattern: date range
CREATE INDEX mv_dashboard_daily_date_key_idx
    ON mv_dashboard_daily (date_key);

-- Date range with cohort
CREATE INDEX mv_dashboard_daily_date_cohort_idx
    ON mv_dashboard_daily (date_key, cohort_id)
    WHERE cohort_id IS NOT NULL;

-- Cohort filter
CREATE INDEX mv_dashboard_daily_cohort_id_idx
    ON mv_dashboard_daily (cohort_id)
    WHERE cohort_id IS NOT NULL;

-- Simulation filter
CREATE INDEX mv_dashboard_daily_simulation_id_idx
    ON mv_dashboard_daily (simulation_id);

-- Composite for dashboard queries
CREATE INDEX mv_dashboard_daily_cohort_simulation_date_idx
    ON mv_dashboard_daily (cohort_id, simulation_id, date_key DESC)
    WHERE cohort_id IS NOT NULL;

-- ============================================================================
-- Step 6: Refresh Materialized View with Data
-- ============================================================================

REFRESH MATERIALIZED VIEW mv_dashboard_daily;
