-- ============================================================================
-- Query: get_analytics_profile_facts_view
-- Purpose: Fetch filtered chat-grain rows from mv_profile_facts
-- Section: VIEWS/ANALYTICS/PROFILE_FACTS
--
-- Includes:
-- - Filtering (profile, cohort, department, simulation, attempt_type, archived, date range)
-- - Sorting (date)
-- - Pagination
-- - Filter options (simulation_options, cohort_options, department_options)
--
-- Note: Returns chat-grain rows with resource IDs only.
-- All aggregation (profile metrics, daily trends, etc.) is done in Python.
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

-- Chat-grain profile facts item with all MV columns
CREATE TYPE types.q_get_analytics_profile_facts_view_v4_item AS (
    -- Primary key
    chat_id uuid,

    -- Resource IDs
    attempt_id uuid,
    profile_id uuid,
    cohort_id uuid,
    department_id uuid,
    simulation_id uuid,
    scenario_id uuid,

    -- Timestamps
    attempt_date date,

    -- Measures
    grade_percent numeric,
    passed boolean,
    completed boolean,
    time_taken_seconds int,
    num_messages_total int,
    avg_response_sec numeric,

    -- Filters
    attempt_type text,
    is_archived boolean,
    infinite_mode boolean
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
    sort_by text DEFAULT 'date',
    sort_order text DEFAULT 'desc',
    -- Pagination
    page_limit int DEFAULT 10000,
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
    -- Apply all filters to mv_profile_facts
    filtered AS (
        SELECT
            pf.chat_id,
            pf.attempt_id,
            pf.profile_id,
            pf.cohort_id,
            pf.department_id,
            pf.simulation_id,
            pf.scenario_id,
            pf.attempt_date,
            pf.grade_percent,
            pf.passed,
            pf.completed,
            pf.time_taken_seconds,
            pf.num_messages_total,
            pf.avg_response_sec,
            pf.attempt_type,
            pf.is_archived,
            pf.infinite_mode
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
    -- Count total before pagination
    counted AS (
        SELECT COUNT(*)::int AS total FROM filtered
    ),
    -- Sort and paginate
    sorted AS (
        SELECT *
        FROM filtered
        ORDER BY
            CASE WHEN sort_by = 'date' AND sort_order = 'desc'
                 THEN attempt_date END DESC NULLS LAST,
            CASE WHEN sort_by = 'date' AND sort_order = 'asc'
                 THEN attempt_date END ASC NULLS LAST,
            -- Secondary sort by chat_id for stability
            chat_id DESC
        LIMIT page_limit
        OFFSET page_offset
    ),
    -- Aggregate items into array
    items_agg AS (
        SELECT COALESCE(
            ARRAY_AGG(
                (
                    chat_id,
                    attempt_id,
                    profile_id,
                    cohort_id,
                    department_id,
                    simulation_id,
                    scenario_id,
                    attempt_date,
                    grade_percent,
                    passed,
                    completed,
                    time_taken_seconds,
                    num_messages_total,
                    avg_response_sec,
                    attempt_type,
                    is_archived,
                    infinite_mode
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
