-- ============================================================================
-- Query Function: api_get_daily_metrics_v4
-- Filters mv_daily_metrics for time series data and growth charts.
--
-- Used by: Dashboard Growth Chart, daily trends analysis
-- ============================================================================

-- ============================================================================
-- Step 1: Safe drop function (all overloads)
-- ============================================================================

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_get_daily_metrics_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_daily_metrics_v4(%s)', r.sig);
    END LOOP;
END $$;

-- ============================================================================
-- Step 2: Safe drop composite types
-- ============================================================================

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT typname
        FROM pg_type
        WHERE typname LIKE 'q_get_daily_metrics_v4_%'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I CASCADE', r.typname);
    END LOOP;
END $$;

-- ============================================================================
-- Step 3: Create composite types
-- ============================================================================

-- Filter option type (for dropdowns)
CREATE TYPE types.q_get_daily_metrics_v4_filter_option AS (
    id uuid,
    name text
);

-- Daily row type
CREATE TYPE types.q_get_daily_metrics_v4_row AS (
    date_key date,
    cohort_id uuid,
    simulation_id uuid,
    attempt_type text,
    is_archived boolean,
    -- Metrics
    attempt_count int,
    unique_profiles int,
    completed_count int,
    passed_count int,
    avg_score numeric,
    total_time_seconds int,
    avg_messages numeric,
    -- Resource metadata (JOINed)
    cohort_name text,
    simulation_name text
);

-- Summary statistics type
CREATE TYPE types.q_get_daily_metrics_v4_summary AS (
    total_attempts int,
    total_unique_profiles int,
    total_completed int,
    total_passed int,
    overall_avg_score numeric,
    total_time_seconds int,
    avg_daily_attempts numeric,
    peak_day date,
    peak_day_attempts int
);

-- ============================================================================
-- Step 4: Create function
-- ============================================================================

CREATE OR REPLACE FUNCTION api_get_daily_metrics_v4(
    -- Filter parameters
    cohort_ids uuid[] DEFAULT NULL,
    simulation_ids uuid[] DEFAULT NULL,
    attempt_type_param text DEFAULT NULL,
    show_archived boolean DEFAULT FALSE,
    date_from date DEFAULT NULL,
    date_to date DEFAULT NULL,
    -- Grouping options
    group_by_cohort boolean DEFAULT TRUE,
    group_by_simulation boolean DEFAULT FALSE
)
RETURNS TABLE (
    rows types.q_get_daily_metrics_v4_row[],
    summary types.q_get_daily_metrics_v4_summary,
    cohort_options types.q_get_daily_metrics_v4_filter_option[],
    simulation_options types.q_get_daily_metrics_v4_filter_option[]
)
LANGUAGE sql
STABLE
AS $$
WITH
-- Parameter normalization
params AS (
    SELECT
        COALESCE(cohort_ids, ARRAY[]::uuid[]) AS cohort_ids,
        COALESCE(simulation_ids, ARRAY[]::uuid[]) AS simulation_ids,
        attempt_type_param AS attempt_type,
        COALESCE(show_archived, FALSE) AS show_archived,
        COALESCE(date_from, CURRENT_DATE - INTERVAL '30 days') AS date_from,
        COALESCE(date_to, CURRENT_DATE + INTERVAL '1 day') AS date_to,
        COALESCE(group_by_cohort, TRUE) AS group_by_cohort,
        COALESCE(group_by_simulation, FALSE) AS group_by_simulation
),
-- Base filtered data from MV
base_data AS (
    SELECT
        mv.date_key,
        mv.cohort_id,
        mv.simulation_id,
        mv.attempt_type,
        mv.is_archived,
        mv.attempt_count,
        mv.unique_profiles,
        mv.completed_count,
        mv.passed_count,
        mv.avg_score,
        mv.total_time_seconds,
        mv.avg_messages,
        -- Resource metadata
        cr.name AS cohort_name,
        sr.name AS simulation_name
    FROM params p
    CROSS JOIN mv_daily_metrics mv
    LEFT JOIN cohorts_resource cr ON cr.id = mv.cohort_id
    JOIN simulations_resource sr ON sr.id = mv.simulation_id
    WHERE
        -- Cohort filter
        (cardinality(p.cohort_ids) = 0 OR mv.cohort_id = ANY(p.cohort_ids))
        -- Simulation filter
        AND (cardinality(p.simulation_ids) = 0 OR mv.simulation_id = ANY(p.simulation_ids))
        -- Attempt type filter
        AND (p.attempt_type IS NULL OR mv.attempt_type = p.attempt_type)
        -- Archived filter
        AND (p.show_archived OR mv.is_archived = FALSE)
        -- Date range filter
        AND mv.date_key >= p.date_from
        AND mv.date_key < p.date_to
),
-- Aggregated by grouping dimensions
aggregated_data AS (
    SELECT
        bd.date_key,
        CASE WHEN p.group_by_cohort THEN bd.cohort_id ELSE NULL END AS cohort_id,
        CASE WHEN p.group_by_simulation THEN bd.simulation_id ELSE NULL END AS simulation_id,
        bd.attempt_type,
        bd.is_archived,
        SUM(bd.attempt_count)::int AS attempt_count,
        SUM(bd.unique_profiles)::int AS unique_profiles,
        SUM(bd.completed_count)::int AS completed_count,
        SUM(bd.passed_count)::int AS passed_count,
        ROUND(AVG(bd.avg_score) FILTER (WHERE bd.avg_score IS NOT NULL), 2) AS avg_score,
        SUM(bd.total_time_seconds)::int AS total_time_seconds,
        ROUND(AVG(bd.avg_messages) FILTER (WHERE bd.avg_messages IS NOT NULL), 2) AS avg_messages,
        -- Resource names (for grouped rows)
        MAX(bd.cohort_name) AS cohort_name,
        MAX(bd.simulation_name) AS simulation_name
    FROM base_data bd, params p
    GROUP BY
        bd.date_key,
        CASE WHEN p.group_by_cohort THEN bd.cohort_id ELSE NULL END,
        CASE WHEN p.group_by_simulation THEN bd.simulation_id ELSE NULL END,
        bd.attempt_type,
        bd.is_archived
    ORDER BY bd.date_key
),
-- Summary statistics
summary_stats AS (
    SELECT
        SUM(bd.attempt_count)::int AS total_attempts,
        SUM(bd.unique_profiles)::int AS total_unique_profiles,
        SUM(bd.completed_count)::int AS total_completed,
        SUM(bd.passed_count)::int AS total_passed,
        ROUND(AVG(bd.avg_score) FILTER (WHERE bd.avg_score IS NOT NULL), 2) AS overall_avg_score,
        SUM(bd.total_time_seconds)::int AS total_time_seconds,
        ROUND(AVG(bd.attempt_count)::numeric, 2) AS avg_daily_attempts
    FROM base_data bd
),
-- Peak day calculation
peak_day AS (
    SELECT
        bd.date_key AS peak_day,
        SUM(bd.attempt_count)::int AS peak_day_attempts
    FROM base_data bd
    GROUP BY bd.date_key
    ORDER BY SUM(bd.attempt_count) DESC
    LIMIT 1
),
-- Cohort filter options (from all data in date range)
cohort_options AS (
    SELECT DISTINCT
        bd.cohort_id AS id,
        bd.cohort_name AS name
    FROM base_data bd
    WHERE bd.cohort_id IS NOT NULL
    ORDER BY name
),
-- Simulation filter options
simulation_options AS (
    SELECT DISTINCT
        bd.simulation_id AS id,
        bd.simulation_name AS name
    FROM base_data bd
    ORDER BY name
)
SELECT
    COALESCE(
        (SELECT ARRAY_AGG(
            (ad.date_key, ad.cohort_id, ad.simulation_id, ad.attempt_type, ad.is_archived,
             ad.attempt_count, ad.unique_profiles, ad.completed_count, ad.passed_count,
             ad.avg_score, ad.total_time_seconds, ad.avg_messages,
             ad.cohort_name, ad.simulation_name
            )::types.q_get_daily_metrics_v4_row
            ORDER BY ad.date_key
        ) FROM aggregated_data ad),
        ARRAY[]::types.q_get_daily_metrics_v4_row[]
    ),
    (
        SELECT (
            ss.total_attempts,
            ss.total_unique_profiles,
            ss.total_completed,
            ss.total_passed,
            ss.overall_avg_score,
            ss.total_time_seconds,
            ss.avg_daily_attempts,
            pd.peak_day,
            pd.peak_day_attempts
        )::types.q_get_daily_metrics_v4_summary
        FROM summary_stats ss
        LEFT JOIN peak_day pd ON TRUE
    ),
    COALESCE(
        (SELECT ARRAY_AGG((co.id, co.name)::types.q_get_daily_metrics_v4_filter_option)
         FROM cohort_options co),
        ARRAY[]::types.q_get_daily_metrics_v4_filter_option[]
    ),
    COALESCE(
        (SELECT ARRAY_AGG((so.id, so.name)::types.q_get_daily_metrics_v4_filter_option)
         FROM simulation_options so),
        ARRAY[]::types.q_get_daily_metrics_v4_filter_option[]
    );
$$;
