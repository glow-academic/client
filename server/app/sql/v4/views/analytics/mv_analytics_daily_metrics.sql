-- Materialized View: mv_daily_metrics
-- Time series data for growth charts and daily trends.
--
-- Grain: One row per (date, cohort_id, simulation_id, attempt_type, is_archived)
-- Filter: None at MV level - all data included (filtering done at query time)
--
-- Purpose: Time series data for Dashboard growth charts and daily trends
-- Section: ANALYTICS (self-contained, no MV dependencies)
--
-- Dependencies: Uses entry tables only
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
WITH
latest_grade AS (
    SELECT DISTINCT ON (g.chat_id)
        g.chat_id,
        g.score,
        g.passed,
        g.time_taken,
        g.total_points AS rubric_total_points
    FROM simulation_grades_entry g
    WHERE g.active = TRUE
    ORDER BY g.chat_id, g.created_at DESC
),
message_stats AS (
    SELECT
        sm.chat_id,
        COUNT(*)::int AS num_messages_total
    FROM simulation_messages_entry sm
    JOIN messages_entry m ON m.id = sm.id
    WHERE m.active = TRUE
      AND m.role IN ('user'::message_type, 'assistant'::message_type)
    GROUP BY sm.chat_id
),
chat_facts AS (
    SELECT
        c.attempt_id,
        asc_conn.simulations_id AS simulation_id,
        apc.profiles_id AS profile_id,
        acc.cohorts_id AS cohort_id,
        a.created_at AS attempt_created_at,
        CASE WHEN COALESCE(a.practice, FALSE) THEN 'practice' ELSE 'general' END AS attempt_type,
        COALESCE(a.archived, FALSE) AS is_archived,
        (EXISTS (SELECT 1 FROM simulation_completions_entry comp WHERE comp.chat_id = c.id AND comp.active = TRUE)) AS completed,
        lg.passed,
        lg.time_taken,
        CASE
            WHEN lg.rubric_total_points IS NOT NULL AND lg.rubric_total_points > 0
            THEN ROUND((lg.score::numeric / lg.rubric_total_points::numeric) * 100, 2)
            ELSE NULL
        END AS grade_percent,
        COALESCE(ms.num_messages_total, 0) AS num_messages_total
    FROM simulation_chats_entry c
    JOIN simulation_attempts_entry a ON a.id = c.attempt_id
    JOIN simulation_attempts_simulations_connection asc_conn ON asc_conn.attempt_id = a.id
    JOIN simulation_attempts_profiles_connection apc ON apc.attempt_id = a.id
    LEFT JOIN simulation_attempts_cohorts_connection acc ON acc.attempt_id = a.id
    LEFT JOIN latest_grade lg ON lg.chat_id = c.id
    LEFT JOIN message_stats ms ON ms.chat_id = c.id
    WHERE c.active = TRUE
      AND a.active = TRUE
)
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

FROM chat_facts cf
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
