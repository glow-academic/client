-- Materialized View: mv_dashboard_daily
-- Time series aggregation for DASHBOARD section - growth charts, daily trends.
--
-- Grain: One row per (date, cohort_id, simulation_id, attempt_type)
-- Purpose: Growth charts, daily trends
--
-- Section: DASHBOARD
-- Source: Aggregate from mv_dashboard_chat_facts grouped by date + cohort + simulation + type
--
-- ============================================================================
-- Step 1: Drop all indexes on mv_dashboard_daily materialized view (if it exists)
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
-- Step 2: Drop mv_dashboard_daily materialized view if it exists
-- ============================================================================

DROP MATERIALIZED VIEW IF EXISTS mv_dashboard_daily CASCADE;

-- ============================================================================
-- Step 3: Create mv_dashboard_daily Materialized View
-- ============================================================================

CREATE MATERIALIZED VIEW mv_dashboard_daily AS
SELECT
    -- Keys
    (attempt_created_at::date) AS date_key,
    cohort_id,
    simulation_id,
    attempt_type,

    -- Aggregated metrics
    COUNT(DISTINCT attempt_id)::int AS attempt_count,
    COUNT(DISTINCT profile_id)::int AS unique_profiles,
    COUNT(*) FILTER (WHERE completed = TRUE)::int AS completed_count,
    COUNT(*) FILTER (WHERE passed = TRUE)::int AS passed_count,
    TRUNC(AVG(grade_percent), 2) AS avg_score,
    SUM(COALESCE(time_taken, 0))::int AS total_time_seconds,
    TRUNC(AVG(num_messages_total), 2) AS avg_messages

FROM mv_dashboard_chat_facts
WHERE is_archived = FALSE  -- Exclude archived from daily metrics
GROUP BY (attempt_created_at::date), cohort_id, simulation_id, attempt_type
WITH NO DATA;

-- ============================================================================
-- Step 4: Create Unique Index (Required for CONCURRENT refresh)
-- ============================================================================

CREATE UNIQUE INDEX mv_dashboard_daily_pk
    ON mv_dashboard_daily (
        date_key,
        COALESCE(cohort_id, '00000000-0000-0000-0000-000000000000'::uuid),
        simulation_id,
        attempt_type
    );

-- ============================================================================
-- Step 5: Create Filter/Slicing Indexes
-- ============================================================================

-- Primary time-based lookup
CREATE INDEX mv_dashboard_daily_date_key_idx
    ON mv_dashboard_daily (date_key);

-- Date range queries (most common)
CREATE INDEX mv_dashboard_daily_date_range_idx
    ON mv_dashboard_daily (date_key DESC);

-- Cohort filtering
CREATE INDEX mv_dashboard_daily_cohort_id_idx
    ON mv_dashboard_daily (cohort_id)
    WHERE cohort_id IS NOT NULL;

-- Simulation filtering
CREATE INDEX mv_dashboard_daily_simulation_id_idx
    ON mv_dashboard_daily (simulation_id);

-- Attempt type filtering
CREATE INDEX mv_dashboard_daily_attempt_type_idx
    ON mv_dashboard_daily (attempt_type);

-- Composite: cohort + date for cohort time series
CREATE INDEX mv_dashboard_daily_cohort_date_idx
    ON mv_dashboard_daily (cohort_id, date_key DESC)
    WHERE cohort_id IS NOT NULL;

-- Composite: simulation + date for simulation time series
CREATE INDEX mv_dashboard_daily_simulation_date_idx
    ON mv_dashboard_daily (simulation_id, date_key DESC);

-- Composite: cohort + simulation + date for filtered time series
CREATE INDEX mv_dashboard_daily_cohort_simulation_date_idx
    ON mv_dashboard_daily (cohort_id, simulation_id, date_key DESC)
    WHERE cohort_id IS NOT NULL;

-- Composite: type + date for type-specific time series
CREATE INDEX mv_dashboard_daily_type_date_idx
    ON mv_dashboard_daily (attempt_type, date_key DESC);

-- ============================================================================
-- Step 6: Refresh Materialized View with Data
-- ============================================================================

REFRESH MATERIALIZED VIEW mv_dashboard_daily;
