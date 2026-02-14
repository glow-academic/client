-- ============================================================================
-- Query: get_analytics_cohort_facts_view
-- Purpose: Fetch paginated cohort-level data from mv_cohort_facts
-- Section: VIEWS/ANALYTICS/COHORT_FACTS
--
-- Includes:
-- - Filtering (profile, cohort, simulation, attempt_type, archived, date range)
-- - Sorting (date)
-- - Pagination
-- - Filter options (cohort_options, simulation_options, persona_options)
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
        WHERE proname = 'api_get_analytics_cohort_facts_view_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_analytics_cohort_facts_view_v4(%s)', r.sig);
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
        WHERE typname LIKE 'q_get_analytics_cohort_facts_view_v4_%'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I CASCADE', r.typname);
    END LOOP;
END $$;

-- ============================================================================
-- Step 3: Create composite types
-- ============================================================================

-- Cohort facts item with all MV columns
CREATE TYPE types.q_get_analytics_cohort_facts_view_v4_item AS (
    -- Primary key
    chat_id uuid,

    -- Resource IDs (metadata fetched via internal handlers)
    attempt_id uuid,
    profile_id uuid,
    cohort_id uuid,
    simulation_id uuid,
    persona_id uuid,

    -- Timestamps
    attempt_date date,

    -- Pre-computed
    attempt_number int,

    -- Measures
    grade_percent numeric,
    passed boolean,
    completed boolean,
    time_taken_seconds int,

    -- Filters
    attempt_type text,              -- 'general' | 'practice'
    is_archived boolean
);

-- Filter option type for dropdowns
CREATE TYPE types.q_get_analytics_cohort_facts_view_v4_option AS (
    value text,
    label text,
    count int
);

-- ============================================================================
-- Step 4: Create function
-- ============================================================================

CREATE OR REPLACE FUNCTION api_get_analytics_cohort_facts_view_v4(
    -- Filters
    profile_id_filter uuid DEFAULT NULL,
    cohort_ids uuid[] DEFAULT NULL,
    simulation_ids uuid[] DEFAULT NULL,
    attempt_type_filter text DEFAULT NULL,      -- 'general' | 'practice' | NULL (both)
    is_archived_filter boolean DEFAULT FALSE,
    date_from date DEFAULT NULL,
    date_to date DEFAULT NULL,
    -- Sorting
    sort_by text DEFAULT 'date',
    sort_order text DEFAULT 'desc',
    -- Pagination
    page_limit int DEFAULT 5000,
    page_offset int DEFAULT 0
)
RETURNS TABLE (
    items types.q_get_analytics_cohort_facts_view_v4_item[],
    total_count int,
    cohort_options types.q_get_analytics_cohort_facts_view_v4_option[],
    simulation_options types.q_get_analytics_cohort_facts_view_v4_option[],
    persona_options types.q_get_analytics_cohort_facts_view_v4_option[]
)
LANGUAGE sql
STABLE
AS $$
    WITH
    -- Apply all filters to mv_cohort_facts
    filtered AS (
        SELECT
            cf.chat_id,
            cf.attempt_id,
            cf.profile_id,
            cf.cohort_id,
            cf.simulation_id,
            cf.persona_id,
            cf.attempt_date,
            cf.attempt_number,
            cf.grade_percent,
            cf.passed,
            cf.completed,
            cf.time_taken_seconds,
            cf.attempt_type,
            cf.is_archived
        FROM mv_cohort_facts cf
        WHERE
            -- Profile filter
            (profile_id_filter IS NULL OR cf.profile_id = profile_id_filter)
            -- Cohort IDs filter
            AND (cohort_ids IS NULL OR cardinality(cohort_ids) = 0 OR cf.cohort_id = ANY(cohort_ids))
            -- Simulation IDs filter
            AND (simulation_ids IS NULL OR cardinality(simulation_ids) = 0 OR cf.simulation_id = ANY(simulation_ids))
            -- Attempt type filter
            AND (attempt_type_filter IS NULL OR cf.attempt_type = attempt_type_filter)
            -- Archived filter (default excludes archived)
            AND cf.is_archived = COALESCE(is_archived_filter, FALSE)
            -- Date range filter
            AND (date_from IS NULL OR cf.attempt_date >= date_from)
            AND (date_to IS NULL OR cf.attempt_date <= date_to)
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
                    simulation_id,
                    persona_id,
                    attempt_date,
                    attempt_number,
                    grade_percent,
                    passed,
                    completed,
                    time_taken_seconds,
                    attempt_type,
                    is_archived
                )::types.q_get_analytics_cohort_facts_view_v4_item
            ),
            ARRAY[]::types.q_get_analytics_cohort_facts_view_v4_item[]
        ) AS items
        FROM sorted
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
                (value, label, count)::types.q_get_analytics_cohort_facts_view_v4_option
            ),
            ARRAY[]::types.q_get_analytics_cohort_facts_view_v4_option[]
        ) AS options
        FROM cohort_options_cte
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
                (value, label, count)::types.q_get_analytics_cohort_facts_view_v4_option
            ),
            ARRAY[]::types.q_get_analytics_cohort_facts_view_v4_option[]
        ) AS options
        FROM simulation_options_cte
    ),
    -- Persona filter options (from filtered, not sorted)
    persona_options_cte AS (
        SELECT
            f.persona_id::text AS value,
            f.persona_id::text AS label,  -- Label resolved by handler
            COUNT(DISTINCT f.chat_id)::int AS count
        FROM filtered f
        WHERE f.persona_id IS NOT NULL
        GROUP BY f.persona_id
        ORDER BY count DESC, value
    ),
    persona_options_agg AS (
        SELECT COALESCE(
            ARRAY_AGG(
                (value, label, count)::types.q_get_analytics_cohort_facts_view_v4_option
            ),
            ARRAY[]::types.q_get_analytics_cohort_facts_view_v4_option[]
        ) AS options
        FROM persona_options_cte
    )
    SELECT
        (SELECT items FROM items_agg),
        (SELECT total FROM counted),
        (SELECT options FROM cohort_options_agg),
        (SELECT options FROM simulation_options_agg),
        (SELECT options FROM persona_options_agg);
$$;
