-- ============================================================================
-- Query: get_analytics_profile_facts_view
-- Purpose: Fetch profile-level aggregated metrics from mv_profile_facts
-- Section: VIEWS/ANALYTICS/PROFILE_FACTS
--
-- Includes:
-- - Filtering at chat grain (profile, cohort, department, simulation, attempt_type, archived, date range)
-- - GROUP BY profile_id to produce 12 profile metrics
-- - Daily trend arrays (daily_dates, daily_avg_scores, daily_attempt_counts, daily_completed_counts, daily_time_minutes)
-- - Filter options (simulation_options, cohort_options, department_options)
--
-- Note: Returns resource IDs only. Metadata (names, avatars) fetched via internal handlers.
-- ============================================================================

-- ============================================================================
-- Step 1: Drop existing function
-- ============================================================================

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_get_analytics_profile_facts_view_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_analytics_profile_facts_view_v4(%s)', r.sig);
    END LOOP;
END $$;

-- ============================================================================
-- Step 2: Drop existing composite types
-- ============================================================================

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT typname
        FROM pg_type
        WHERE typname LIKE 'q_get_analytics_profile_facts_view_v4_%'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I CASCADE', r.typname);
    END LOOP;
END $$;

-- ============================================================================
-- Step 3: Create composite types
-- ============================================================================

-- Profile-level aggregated metrics item
CREATE TYPE types.q_get_analytics_profile_facts_view_v4_item AS (
    -- Profile key
    profile_id uuid,

    -- 12 profile metrics
    total_attempts int,
    avg_score numeric,
    highest_score numeric,
    completion_pct numeric,
    first_attempt_pass_rate numeric,
    avg_messages_per_session numeric,
    avg_persona_response_sec numeric,
    session_efficiency numeric,
    total_time_minutes numeric,
    improvement_rate numeric,
    perfect_score_count int,
    quickest_pass_minutes numeric,

    -- Daily trend arrays
    daily_dates date[],
    daily_avg_scores numeric[],
    daily_attempt_counts int[],
    daily_completed_counts int[],
    daily_time_minutes numeric[]
);

-- Filter option type for dropdowns
CREATE TYPE types.q_get_analytics_profile_facts_view_v4_option AS (
    value text,
    label text,
    count int
);

-- ============================================================================
-- Step 4: Create function
-- ============================================================================

CREATE OR REPLACE FUNCTION api_get_analytics_profile_facts_view_v4(
    -- Filters
    profile_id_filter uuid DEFAULT NULL,
    cohort_ids uuid[] DEFAULT NULL,
    department_ids uuid[] DEFAULT NULL,
    simulation_ids uuid[] DEFAULT NULL,
    attempt_type_filter text DEFAULT NULL,      -- 'general' | 'practice' | NULL (both)
    is_archived_filter boolean DEFAULT FALSE,
    date_from date DEFAULT NULL,
    date_to date DEFAULT NULL,
    -- Sorting
    sort_by text DEFAULT 'avg_score',
    sort_order text DEFAULT 'desc',
    -- Pagination
    page_limit int DEFAULT 5000,
    page_offset int DEFAULT 0
)
RETURNS TABLE (
    items types.q_get_analytics_profile_facts_view_v4_item[],
    total_count int,
    simulation_options types.q_get_analytics_profile_facts_view_v4_option[],
    cohort_options types.q_get_analytics_profile_facts_view_v4_option[],
    department_options types.q_get_analytics_profile_facts_view_v4_option[]
)
LANGUAGE sql
STABLE
AS $$
    WITH
    -- Apply all filters at chat grain
    filtered AS (
        SELECT
            pf.chat_id,
            pf.attempt_id,
            pf.profile_id,
            pf.cohort_id,
            pf.department_id,
            pf.simulation_id,
            pf.attempt_date,
            pf.grade_percent,
            pf.passed,
            pf.completed,
            pf.time_taken_seconds,
            pf.num_messages_total,
            pf.avg_response_sec,
            pf.attempt_type,
            pf.is_archived
        FROM mv_profile_facts pf
        WHERE
            -- Profile filter
            (profile_id_filter IS NULL OR pf.profile_id = profile_id_filter)
            -- Cohort IDs filter
            AND (cohort_ids IS NULL OR cardinality(cohort_ids) = 0 OR pf.cohort_id = ANY(cohort_ids))
            -- Department IDs filter
            AND (department_ids IS NULL OR cardinality(department_ids) = 0 OR pf.department_id = ANY(department_ids))
            -- Simulation IDs filter
            AND (simulation_ids IS NULL OR cardinality(simulation_ids) = 0 OR pf.simulation_id = ANY(simulation_ids))
            -- Attempt type filter
            AND (attempt_type_filter IS NULL OR pf.attempt_type = attempt_type_filter)
            -- Archived filter (default excludes archived)
            AND pf.is_archived = COALESCE(is_archived_filter, FALSE)
            -- Date range filter
            AND (date_from IS NULL OR pf.attempt_date >= date_from)
            AND (date_to IS NULL OR pf.attempt_date <= date_to)
    ),
    -- First attempt per profile (for first_attempt_pass_rate)
    first_attempts AS (
        SELECT DISTINCT ON (f.profile_id)
            f.profile_id,
            f.passed AS first_attempt_passed
        FROM filtered f
        WHERE f.completed = TRUE
        ORDER BY f.profile_id, f.attempt_date, f.chat_id
    ),
    -- Quickest passing attempt per profile
    quickest_pass AS (
        SELECT DISTINCT ON (f.profile_id)
            f.profile_id,
            f.time_taken_seconds AS quickest_pass_seconds
        FROM filtered f
        WHERE f.passed = TRUE
          AND f.time_taken_seconds IS NOT NULL
          AND f.time_taken_seconds > 0
        ORDER BY f.profile_id, f.time_taken_seconds
    ),
    -- Improvement rate: comparing first half vs second half of attempts
    improvement_calc AS (
        SELECT
            profile_id,
            ROUND(
                AVG(CASE WHEN rn > cnt / 2 THEN grade_percent ELSE NULL END) -
                AVG(CASE WHEN rn <= cnt / 2 THEN grade_percent ELSE NULL END),
                2
            ) AS improvement_rate
        FROM (
            SELECT
                f.profile_id,
                f.grade_percent,
                ROW_NUMBER() OVER (
                    PARTITION BY f.profile_id
                    ORDER BY f.attempt_date, f.chat_id
                ) AS rn,
                COUNT(*) OVER (
                    PARTITION BY f.profile_id
                ) AS cnt
            FROM filtered f
            WHERE f.grade_percent IS NOT NULL
        ) ranked
        WHERE cnt >= 2
        GROUP BY profile_id
    ),
    -- Session efficiency: score per minute
    efficiency_calc AS (
        SELECT
            f.profile_id,
            ROUND(
                AVG(
                    CASE
                        WHEN f.time_taken_seconds > 0 AND f.grade_percent IS NOT NULL
                        THEN f.grade_percent / (f.time_taken_seconds / 60.0)
                        ELSE NULL
                    END
                ),
                2
            ) AS session_efficiency
        FROM filtered f
        WHERE f.time_taken_seconds > 0
        GROUP BY f.profile_id
    ),
    -- Daily trend data per profile
    daily_trends AS (
        SELECT
            f.profile_id,
            ARRAY_AGG(d.day ORDER BY d.day) AS daily_dates,
            ARRAY_AGG(d.avg_score ORDER BY d.day) AS daily_avg_scores,
            ARRAY_AGG(d.attempt_count ORDER BY d.day) AS daily_attempt_counts,
            ARRAY_AGG(d.completed_count ORDER BY d.day) AS daily_completed_counts,
            ARRAY_AGG(d.time_minutes ORDER BY d.day) AS daily_time_minutes
        FROM (SELECT DISTINCT profile_id FROM filtered) f
        CROSS JOIN LATERAL (
            SELECT
                fd.attempt_date AS day,
                ROUND(AVG(fd.grade_percent) FILTER (WHERE fd.grade_percent IS NOT NULL), 2) AS avg_score,
                COUNT(DISTINCT fd.attempt_id)::int AS attempt_count,
                COUNT(*) FILTER (WHERE fd.completed = TRUE)::int AS completed_count,
                ROUND(COALESCE(SUM(fd.time_taken_seconds) FILTER (WHERE fd.time_taken_seconds IS NOT NULL), 0)::numeric / 60, 2) AS time_minutes
            FROM filtered fd
            WHERE fd.profile_id = f.profile_id
              AND fd.attempt_date IS NOT NULL
            GROUP BY fd.attempt_date
        ) d
        GROUP BY f.profile_id
    ),
    -- Aggregate to profile level
    profile_agg AS (
        SELECT
            f.profile_id,

            -- 12 profile metrics
            COUNT(DISTINCT f.attempt_id)::int AS total_attempts,
            ROUND(AVG(f.grade_percent) FILTER (WHERE f.grade_percent IS NOT NULL), 2) AS avg_score,
            MAX(f.grade_percent) AS highest_score,
            ROUND(
                (COUNT(*) FILTER (WHERE f.completed = TRUE)::numeric /
                 NULLIF(COUNT(*)::numeric, 0)) * 100,
                2
            ) AS completion_pct,
            CASE
                WHEN fa.first_attempt_passed = TRUE THEN 100.0
                WHEN fa.first_attempt_passed = FALSE THEN 0.0
                ELSE NULL
            END AS first_attempt_pass_rate,
            ROUND(AVG(f.num_messages_total)::numeric, 2) AS avg_messages_per_session,
            ROUND(
                AVG(f.avg_response_sec) FILTER (WHERE f.avg_response_sec IS NOT NULL),
                2
            ) AS avg_persona_response_sec,
            ec.session_efficiency,
            ROUND(
                COALESCE(SUM(f.time_taken_seconds) FILTER (WHERE f.time_taken_seconds IS NOT NULL), 0)::numeric / 60,
                2
            ) AS total_time_minutes,
            COALESCE(ic.improvement_rate, 0) AS improvement_rate,
            COUNT(*) FILTER (WHERE f.grade_percent = 100)::int AS perfect_score_count,
            ROUND(qp.quickest_pass_seconds::numeric / 60, 2) AS quickest_pass_minutes,

            -- Daily trends
            dt.daily_dates,
            dt.daily_avg_scores,
            dt.daily_attempt_counts,
            dt.daily_completed_counts,
            dt.daily_time_minutes

        FROM filtered f
        LEFT JOIN first_attempts fa ON fa.profile_id = f.profile_id
        LEFT JOIN quickest_pass qp ON qp.profile_id = f.profile_id
        LEFT JOIN improvement_calc ic ON ic.profile_id = f.profile_id
        LEFT JOIN efficiency_calc ec ON ec.profile_id = f.profile_id
        LEFT JOIN daily_trends dt ON dt.profile_id = f.profile_id
        GROUP BY
            f.profile_id,
            fa.first_attempt_passed,
            ec.session_efficiency,
            ic.improvement_rate,
            qp.quickest_pass_seconds,
            dt.daily_dates,
            dt.daily_avg_scores,
            dt.daily_attempt_counts,
            dt.daily_completed_counts,
            dt.daily_time_minutes
    ),
    -- Count total profiles before pagination
    counted AS (
        SELECT COUNT(*)::int AS total FROM profile_agg
    ),
    -- Sort and paginate profiles
    sorted AS (
        SELECT *
        FROM profile_agg
        ORDER BY
            CASE WHEN sort_by = 'avg_score' AND sort_order = 'desc'
                 THEN avg_score END DESC NULLS LAST,
            CASE WHEN sort_by = 'avg_score' AND sort_order = 'asc'
                 THEN avg_score END ASC NULLS LAST,
            CASE WHEN sort_by = 'total_attempts' AND sort_order = 'desc'
                 THEN total_attempts END DESC NULLS LAST,
            CASE WHEN sort_by = 'total_attempts' AND sort_order = 'asc'
                 THEN total_attempts END ASC NULLS LAST,
            CASE WHEN sort_by = 'highest_score' AND sort_order = 'desc'
                 THEN highest_score END DESC NULLS LAST,
            CASE WHEN sort_by = 'highest_score' AND sort_order = 'asc'
                 THEN highest_score END ASC NULLS LAST,
            -- Secondary sort by profile_id for stability
            profile_id
        LIMIT page_limit
        OFFSET page_offset
    ),
    -- Aggregate items into array
    items_agg AS (
        SELECT COALESCE(
            ARRAY_AGG(
                (
                    profile_id,
                    total_attempts,
                    avg_score,
                    highest_score,
                    completion_pct,
                    first_attempt_pass_rate,
                    avg_messages_per_session,
                    avg_persona_response_sec,
                    session_efficiency,
                    total_time_minutes,
                    improvement_rate,
                    perfect_score_count,
                    quickest_pass_minutes,
                    daily_dates,
                    daily_avg_scores,
                    daily_attempt_counts,
                    daily_completed_counts,
                    daily_time_minutes
                )::types.q_get_analytics_profile_facts_view_v4_item
            ),
            ARRAY[]::types.q_get_analytics_profile_facts_view_v4_item[]
        ) AS items
        FROM sorted
    ),
    -- Simulation filter options (from filtered, not sorted)
    simulation_options_cte AS (
        SELECT
            f.simulation_id::text AS value,
            f.simulation_id::text AS label,  -- Label resolved by handler
            COUNT(DISTINCT f.chat_id)::int AS count
        FROM filtered f
        WHERE f.simulation_id IS NOT NULL
        GROUP BY f.simulation_id
        ORDER BY count DESC, value
    ),
    simulation_options_agg AS (
        SELECT COALESCE(
            ARRAY_AGG(
                (value, label, count)::types.q_get_analytics_profile_facts_view_v4_option
            ),
            ARRAY[]::types.q_get_analytics_profile_facts_view_v4_option[]
        ) AS options
        FROM simulation_options_cte
    ),
    -- Cohort filter options (from filtered, not sorted)
    cohort_options_cte AS (
        SELECT
            f.cohort_id::text AS value,
            f.cohort_id::text AS label,  -- Label resolved by handler
            COUNT(DISTINCT f.chat_id)::int AS count
        FROM filtered f
        WHERE f.cohort_id IS NOT NULL
        GROUP BY f.cohort_id
        ORDER BY count DESC, value
    ),
    cohort_options_agg AS (
        SELECT COALESCE(
            ARRAY_AGG(
                (value, label, count)::types.q_get_analytics_profile_facts_view_v4_option
            ),
            ARRAY[]::types.q_get_analytics_profile_facts_view_v4_option[]
        ) AS options
        FROM cohort_options_cte
    ),
    -- Department filter options (from filtered, not sorted)
    department_options_cte AS (
        SELECT
            f.department_id::text AS value,
            f.department_id::text AS label,  -- Label resolved by handler
            COUNT(DISTINCT f.chat_id)::int AS count
        FROM filtered f
        WHERE f.department_id IS NOT NULL
        GROUP BY f.department_id
        ORDER BY count DESC, value
    ),
    department_options_agg AS (
        SELECT COALESCE(
            ARRAY_AGG(
                (value, label, count)::types.q_get_analytics_profile_facts_view_v4_option
            ),
            ARRAY[]::types.q_get_analytics_profile_facts_view_v4_option[]
        ) AS options
        FROM department_options_cte
    )
    SELECT
        (SELECT items FROM items_agg),
        (SELECT total FROM counted),
        (SELECT options FROM simulation_options_agg),
        (SELECT options FROM cohort_options_agg),
        (SELECT options FROM department_options_agg);
$$;
