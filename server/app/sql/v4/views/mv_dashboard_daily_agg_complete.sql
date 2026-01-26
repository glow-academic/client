-- Materialized View: mv_dashboard_daily_agg
-- Pre-aggregated daily statistics for dashboard performance.
-- Groups by: (agg_date, simulation_id, cohort_id, department_id, attempt_type)
-- Uses idempotent drop/recreate pattern - safe to run multiple times.
--
-- IMPORTANT: This MV depends on mv_dashboard_facts.
-- mv_dashboard_facts must be created and refreshed BEFORE this one.
--
-- Key principle: Pre-aggregated for fast dashboard queries.
-- Still requires query-time joins to resource tables for names.
-- ============================================================================
-- Step 1: Drop all indexes on mv_dashboard_daily_agg materialized view (if it exists)
-- ============================================================================

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT indexname
        FROM pg_indexes
        WHERE schemaname = 'public'
          AND tablename = 'mv_dashboard_daily_agg'
    LOOP
        EXECUTE format('DROP INDEX IF EXISTS %I', r.indexname);
    END LOOP;
END $$;

-- ============================================================================
-- Step 2: Drop mv_dashboard_daily_agg materialized view if it exists
-- ============================================================================

DROP MATERIALIZED VIEW IF EXISTS mv_dashboard_daily_agg CASCADE;

-- ============================================================================
-- Step 3: Create mv_dashboard_daily_agg Materialized View
-- ============================================================================

CREATE MATERIALIZED VIEW mv_dashboard_daily_agg AS
SELECT
    -- Aggregation key
    (attempt_created_at AT TIME ZONE 'UTC')::date AS agg_date,
    simulation_id,
    cohort_id,
    department_id,
    attempt_type,

    -- Attempt/Chat counts
    COUNT(DISTINCT attempt_id)::int AS total_attempts,
    COUNT(DISTINCT chat_id)::int AS total_chats,
    COUNT(DISTINCT chat_id) FILTER (WHERE completed = TRUE)::int AS completed_chats,
    COUNT(DISTINCT chat_id) FILTER (WHERE grade_id IS NOT NULL)::int AS graded_chats,

    -- Score aggregates (for graded chats only)
    SUM(score) FILTER (WHERE score IS NOT NULL)::bigint AS sum_score,
    COUNT(*) FILTER (WHERE passed = TRUE)::int AS passed_count,
    SUM(time_taken) FILTER (WHERE time_taken IS NOT NULL)::bigint AS sum_time_taken,

    -- Message aggregates
    SUM(num_messages_total)::bigint AS sum_messages_total,
    SUM(num_query_messages)::bigint AS sum_query_messages,
    SUM(num_response_messages)::bigint AS sum_response_messages

FROM mv_dashboard_facts
WHERE is_archived = FALSE
GROUP BY
    (attempt_created_at AT TIME ZONE 'UTC')::date,
    simulation_id,
    cohort_id,
    department_id,
    attempt_type
WITH NO DATA;

-- ============================================================================
-- Step 4: Create Unique Index (Required for CONCURRENT refresh)
-- ============================================================================

-- Composite unique key for the aggregation dimensions
CREATE UNIQUE INDEX mv_dashboard_daily_agg_pk
    ON mv_dashboard_daily_agg (
        agg_date,
        simulation_id,
        COALESCE(cohort_id, '00000000-0000-0000-0000-000000000000'::uuid),
        COALESCE(department_id, '00000000-0000-0000-0000-000000000000'::uuid),
        attempt_type
    );

-- ============================================================================
-- Step 5: Create Filter/Slicing Indexes
-- ============================================================================

-- Date range indexes (most common filter)
CREATE INDEX mv_dashboard_daily_agg_date_idx
    ON mv_dashboard_daily_agg (agg_date);

CREATE INDEX mv_dashboard_daily_agg_date_desc_idx
    ON mv_dashboard_daily_agg (agg_date DESC);

-- Dimension indexes for filtering
CREATE INDEX mv_dashboard_daily_agg_simulation_id_idx
    ON mv_dashboard_daily_agg (simulation_id);

CREATE INDEX mv_dashboard_daily_agg_cohort_id_idx
    ON mv_dashboard_daily_agg (cohort_id)
    WHERE cohort_id IS NOT NULL;

CREATE INDEX mv_dashboard_daily_agg_department_id_idx
    ON mv_dashboard_daily_agg (department_id)
    WHERE department_id IS NOT NULL;

CREATE INDEX mv_dashboard_daily_agg_attempt_type_idx
    ON mv_dashboard_daily_agg (attempt_type);

-- Composite indexes for common dashboard query patterns
CREATE INDEX mv_dashboard_daily_agg_sim_date_idx
    ON mv_dashboard_daily_agg (simulation_id, agg_date DESC);

CREATE INDEX mv_dashboard_daily_agg_cohort_date_idx
    ON mv_dashboard_daily_agg (cohort_id, agg_date DESC)
    WHERE cohort_id IS NOT NULL;

CREATE INDEX mv_dashboard_daily_agg_dept_date_idx
    ON mv_dashboard_daily_agg (department_id, agg_date DESC)
    WHERE department_id IS NOT NULL;

CREATE INDEX mv_dashboard_daily_agg_type_date_idx
    ON mv_dashboard_daily_agg (attempt_type, agg_date DESC);

-- Composite indexes for multi-dimension filtering
CREATE INDEX mv_dashboard_daily_agg_sim_cohort_date_idx
    ON mv_dashboard_daily_agg (simulation_id, cohort_id, agg_date DESC);

CREATE INDEX mv_dashboard_daily_agg_sim_dept_date_idx
    ON mv_dashboard_daily_agg (simulation_id, department_id, agg_date DESC);

-- ============================================================================
-- Step 6: Refresh Materialized View with Data
-- ============================================================================

REFRESH MATERIALIZED VIEW mv_dashboard_daily_agg;
