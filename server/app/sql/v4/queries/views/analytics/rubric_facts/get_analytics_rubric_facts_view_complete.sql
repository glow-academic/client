-- ============================================================================
-- Query: get_analytics_rubric_facts_view
-- Purpose: Fetch paginated rubric-level data from mv_rubric_facts
-- Section: VIEWS/ANALYTICS/RUBRIC_FACTS
--
-- Includes:
-- - Filtering (profile, cohort, simulation, rubric, attempt_type, archived, date range)
-- - Sorting (date)
-- - Pagination
-- - Filter options (rubric_options, simulation_options, standard_group_options)
--
-- Note: Returns resource IDs only. Metadata (names, colors) fetched via internal handlers.
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
        WHERE proname = 'api_get_analytics_rubric_facts_view_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_analytics_rubric_facts_view_v4(%s)', r.sig);
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
        WHERE typname LIKE 'q_get_analytics_rubric_facts_view_v4_%'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I CASCADE', r.typname);
    END LOOP;
END $$;

-- ============================================================================
-- Step 3: Create composite types
-- ============================================================================

-- Rubric facts item with all MV columns
CREATE TYPE types.q_get_analytics_rubric_facts_view_v4_item AS (
    -- Composite primary key
    chat_id uuid,
    standard_group_id uuid,

    -- Rubric dimension
    rubric_id uuid,

    -- Score
    score_percent float8,

    -- Resource IDs for filtering
    simulation_id uuid,
    profile_id uuid,
    cohort_id uuid,

    -- Timestamps
    attempt_date date,

    -- Filters
    attempt_type text,              -- 'general' | 'practice'
    is_archived boolean
);

-- Filter option type for dropdowns
CREATE TYPE types.q_get_analytics_rubric_facts_view_v4_option AS (
    value text,
    label text,
    count int
);

-- ============================================================================
-- Step 4: Create function
-- ============================================================================

CREATE OR REPLACE FUNCTION api_get_analytics_rubric_facts_view_v4(
    -- Filters
    profile_id_filter uuid DEFAULT NULL,
    cohort_ids uuid[] DEFAULT NULL,
    simulation_ids uuid[] DEFAULT NULL,
    rubric_ids uuid[] DEFAULT NULL,
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
    items types.q_get_analytics_rubric_facts_view_v4_item[],
    total_count int,
    rubric_options types.q_get_analytics_rubric_facts_view_v4_option[],
    simulation_options types.q_get_analytics_rubric_facts_view_v4_option[],
    standard_group_options types.q_get_analytics_rubric_facts_view_v4_option[]
)
LANGUAGE sql
STABLE
AS $$
    WITH
    -- Apply all filters to mv_rubric_facts
    filtered AS (
        SELECT
            rf.chat_id,
            rf.standard_group_id,
            rf.rubric_id,
            rf.score_percent,
            rf.simulation_id,
            rf.profile_id,
            rf.cohort_id,
            rf.attempt_date,
            rf.attempt_type,
            rf.is_archived
        FROM mv_rubric_facts rf
        WHERE
            -- Profile filter
            (profile_id_filter IS NULL OR rf.profile_id = profile_id_filter)
            -- Cohort IDs filter
            AND (cohort_ids IS NULL OR cardinality(cohort_ids) = 0 OR rf.cohort_id = ANY(cohort_ids))
            -- Simulation IDs filter
            AND (simulation_ids IS NULL OR cardinality(simulation_ids) = 0 OR rf.simulation_id = ANY(simulation_ids))
            -- Rubric IDs filter
            AND (rubric_ids IS NULL OR cardinality(rubric_ids) = 0 OR rf.rubric_id = ANY(rubric_ids))
            -- Attempt type filter
            AND (attempt_type_filter IS NULL OR rf.attempt_type = attempt_type_filter)
            -- Archived filter (default excludes archived)
            AND rf.is_archived = COALESCE(is_archived_filter, FALSE)
            -- Date range filter
            AND (date_from IS NULL OR rf.attempt_date >= date_from)
            AND (date_to IS NULL OR rf.attempt_date <= date_to)
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
            -- Secondary sort for stability
            chat_id DESC, standard_group_id
        LIMIT page_limit
        OFFSET page_offset
    ),
    -- Aggregate items into array
    items_agg AS (
        SELECT COALESCE(
            ARRAY_AGG(
                (
                    chat_id,
                    standard_group_id,
                    rubric_id,
                    score_percent,
                    simulation_id,
                    profile_id,
                    cohort_id,
                    attempt_date,
                    attempt_type,
                    is_archived
                )::types.q_get_analytics_rubric_facts_view_v4_item
            ),
            ARRAY[]::types.q_get_analytics_rubric_facts_view_v4_item[]
        ) AS items
        FROM sorted
    ),
    -- Rubric filter options (from filtered, not sorted)
    rubric_options_cte AS (
        SELECT
            f.rubric_id::text AS value,
            f.rubric_id::text AS label,  -- Label resolved by handler
            COUNT(DISTINCT f.chat_id)::int AS count
        FROM filtered f
        WHERE f.rubric_id IS NOT NULL
        GROUP BY f.rubric_id
        ORDER BY count DESC, value
    ),
    rubric_options_agg AS (
        SELECT COALESCE(
            ARRAY_AGG(
                (value, label, count)::types.q_get_analytics_rubric_facts_view_v4_option
            ),
            ARRAY[]::types.q_get_analytics_rubric_facts_view_v4_option[]
        ) AS options
        FROM rubric_options_cte
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
                (value, label, count)::types.q_get_analytics_rubric_facts_view_v4_option
            ),
            ARRAY[]::types.q_get_analytics_rubric_facts_view_v4_option[]
        ) AS options
        FROM simulation_options_cte
    ),
    -- Standard group filter options (from filtered, not sorted)
    standard_group_options_cte AS (
        SELECT
            f.standard_group_id::text AS value,
            f.standard_group_id::text AS label,  -- Label resolved by handler
            COUNT(DISTINCT f.chat_id)::int AS count
        FROM filtered f
        WHERE f.standard_group_id IS NOT NULL
        GROUP BY f.standard_group_id
        ORDER BY count DESC, value
    ),
    standard_group_options_agg AS (
        SELECT COALESCE(
            ARRAY_AGG(
                (value, label, count)::types.q_get_analytics_rubric_facts_view_v4_option
            ),
            ARRAY[]::types.q_get_analytics_rubric_facts_view_v4_option[]
        ) AS options
        FROM standard_group_options_cte
    )
    SELECT
        (SELECT items FROM items_agg),
        (SELECT total FROM counted),
        (SELECT options FROM rubric_options_agg),
        (SELECT options FROM simulation_options_agg),
        (SELECT options FROM standard_group_options_agg);
$$;
