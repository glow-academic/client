-- Materialized View: mv_daily_metrics
-- Time series data for growth charts and daily trends.
--
-- Grain: One row per (date, cohort_id, simulation_id, attempt_type, is_archived)
-- Filter: None at MV level - all data included (filtering done at query time)
--
-- Purpose: Time series data for Dashboard growth charts and daily trends
-- Section: ANALYTICS (derived from mv_chat_facts)
--
-- Dependencies: Aggregates from mv_chat_facts grouped by date
-- ============================================================================
-- Step 1: Drop all indexes on mv_daily_metrics materialized view (if it exists)
-- ============================================================================

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT indexname
        FROM pg_indexes
        WHERE schemaname = 'public'
          AND tablename = 'mv_daily_metrics'
    LOOP
        EXECUTE format('DROP INDEX IF EXISTS %I', r.indexname);
    END LOOP;
END $$;

-- ============================================================================
-- Step 2: Drop mv_daily_metrics materialized view if it exists
-- ============================================================================

DROP MATERIALIZED VIEW IF EXISTS mv_daily_metrics CASCADE;

-- ============================================================================
-- Step 3: Create mv_daily_metrics Materialized View
-- ============================================================================

CREATE MATERIALIZED VIEW mv_daily_metrics AS
SELECT
    -- Keys (using DATE for date_key)
    (cf.attempt_created_at AT TIME ZONE 'UTC')::date AS date_key,
    cf.cohort_id,
    cf.simulation_id,
    cf.attempt_type,
    cf.is_archived,

    -- Aggregated metrics
    COUNT(DISTINCT cf.attempt_id)::int AS attempt_count,
    COUNT(DISTINCT cf.profile_id)::int AS unique_profiles,
    COUNT(*) FILTER (WHERE cf.completed = TRUE)::int AS completed_count,
    COUNT(*) FILTER (WHERE cf.passed = TRUE)::int AS passed_count,
    ROUND(AVG(cf.grade_percent) FILTER (WHERE cf.grade_percent IS NOT NULL), 2) AS avg_score,
    COALESCE(SUM(cf.time_taken) FILTER (WHERE cf.time_taken IS NOT NULL), 0)::int AS total_time_seconds,
    ROUND(AVG(cf.num_messages_total)::numeric, 2) AS avg_messages

FROM mv_chat_facts cf
GROUP BY
    (cf.attempt_created_at AT TIME ZONE 'UTC')::date,
    cf.cohort_id,
    cf.simulation_id,
    cf.attempt_type,
    cf.is_archived
WITH NO DATA;

-- ============================================================================
-- Step 4: Create Unique Index (Required for CONCURRENT refresh)
-- ============================================================================

-- Composite primary key (using COALESCE for nullable cohort_id)
CREATE UNIQUE INDEX mv_daily_metrics_pk
    ON mv_daily_metrics (
        date_key,
        COALESCE(cohort_id, '00000000-0000-0000-0000-000000000000'::uuid),
        simulation_id,
        attempt_type,
        is_archived
    );

-- ============================================================================
-- Step 5: Create Filter/Slicing Indexes
-- ============================================================================

-- Time indexes
CREATE INDEX mv_daily_metrics_date_key_idx
    ON mv_daily_metrics (date_key);

CREATE INDEX mv_daily_metrics_date_key_desc_idx
    ON mv_daily_metrics (date_key DESC);

-- Filter indexes
CREATE INDEX mv_daily_metrics_cohort_id_idx
    ON mv_daily_metrics (cohort_id)
    WHERE cohort_id IS NOT NULL;

CREATE INDEX mv_daily_metrics_simulation_id_idx
    ON mv_daily_metrics (simulation_id);

CREATE INDEX mv_daily_metrics_attempt_type_idx
    ON mv_daily_metrics (attempt_type);

CREATE INDEX mv_daily_metrics_is_archived_idx
    ON mv_daily_metrics (is_archived);

-- Composite indexes for common time series queries

-- Dashboard growth chart: cohort + date range
CREATE INDEX mv_daily_metrics_cohort_date_idx
    ON mv_daily_metrics (cohort_id, date_key)
    WHERE cohort_id IS NOT NULL;

-- Dashboard growth chart with type filter: cohort + type + date
CREATE INDEX mv_daily_metrics_cohort_type_date_idx
    ON mv_daily_metrics (cohort_id, attempt_type, date_key)
    WHERE cohort_id IS NOT NULL;

-- Simulation-specific time series: simulation + date
CREATE INDEX mv_daily_metrics_simulation_date_idx
    ON mv_daily_metrics (simulation_id, date_key);

-- Full filter pattern: cohort + simulation + type + date
CREATE INDEX mv_daily_metrics_full_filter_idx
    ON mv_daily_metrics (cohort_id, simulation_id, attempt_type, date_key)
    WHERE cohort_id IS NOT NULL;

-- Partial index for non-archived (most common query)
CREATE INDEX mv_daily_metrics_not_archived_idx
    ON mv_daily_metrics (cohort_id, date_key)
    WHERE is_archived = FALSE AND cohort_id IS NOT NULL;

-- Partial index for non-archived with type
CREATE INDEX mv_daily_metrics_not_archived_type_idx
    ON mv_daily_metrics (cohort_id, attempt_type, date_key)
    WHERE is_archived = FALSE AND cohort_id IS NOT NULL;

-- ============================================================================
-- Step 6: Refresh Materialized View with Data
-- ============================================================================

REFRESH MATERIALIZED VIEW mv_daily_metrics;
