-- ============================================================================
-- Query: get_attempt_list_view
-- Purpose: Fetch attempt-level data from mv_attempt_list with resource JOINs
-- Section: VIEWS/ATTEMPT/LIST
--
-- Includes:
-- - Filtering (attempt_ids, profile, simulation, practice, archived, cohort, department, scenario, date, infinite_mode)
-- - Sorting (date asc/desc)
-- - Pagination
-- - Filter options (simulation_options, scenario_options, profile_options)
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
        WHERE proname = 'api_get_attempt_list_view_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_attempt_list_view_v4(%s)', r.sig);
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
        WHERE typname LIKE 'q_get_attempt_list_view_v4_%'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I CASCADE', r.typname);
    END LOOP;
END $$;

-- ============================================================================
-- Step 3: Create composite types
-- ============================================================================

CREATE TYPE types.q_get_attempt_list_view_v4_item AS (
    -- Primary key
    attempt_id uuid,

    -- Resource IDs (metadata fetched via internal handlers)
    simulation_id uuid,
    profile_id uuid,
    cohort_id uuid,
    department_id uuid,

    -- Flags
    practice boolean,
    infinite_mode boolean,

    -- Timestamps
    created_at timestamptz,

    -- New fields
    is_archived boolean,
    scenario_ids uuid[]
);

-- Filter option type for dropdowns
CREATE TYPE types.q_get_attempt_list_view_v4_option AS (
    value text,
    label text,
    count int
);

-- ============================================================================
-- Step 4: Create function
-- ============================================================================

CREATE OR REPLACE FUNCTION api_get_attempt_list_view_v4(
    -- Existing filters
    attempt_ids uuid[] DEFAULT NULL,
    profile_id_filter uuid DEFAULT NULL,
    simulation_id_filter uuid DEFAULT NULL,
    practice_filter boolean DEFAULT NULL,
    -- New filters
    is_archived_filter boolean DEFAULT FALSE,
    cohort_ids uuid[] DEFAULT NULL,
    department_ids uuid[] DEFAULT NULL,
    scenario_ids_filter uuid[] DEFAULT NULL,
    infinite_mode_filter boolean DEFAULT NULL,
    date_from timestamptz DEFAULT NULL,
    date_to timestamptz DEFAULT NULL,
    -- Sorting
    sort_by_field text DEFAULT 'date',
    sort_order_field text DEFAULT 'desc',
    -- Pagination
    page_limit_val int DEFAULT 50,
    page_offset_val int DEFAULT 0
)
RETURNS TABLE (
    items types.q_get_attempt_list_view_v4_item[],
    total_count int,
    simulation_options types.q_get_attempt_list_view_v4_option[],
    scenario_options types.q_get_attempt_list_view_v4_option[],
    profile_options types.q_get_attempt_list_view_v4_option[]
)
LANGUAGE sql
STABLE
AS $$
    WITH
    -- Apply all filters to mv_attempt_list
    filtered AS (
        SELECT mv.*
        FROM mv_attempt_list mv
        WHERE
            -- Attempt IDs filter (for single-attempt lookups)
            (attempt_ids IS NULL OR mv.attempt_id = ANY(attempt_ids))
            -- Profile filter
            AND (profile_id_filter IS NULL OR mv.profile_id = profile_id_filter)
            -- Simulation filter
            AND (simulation_id_filter IS NULL OR mv.simulation_id = simulation_id_filter)
            -- Practice filter
            AND (practice_filter IS NULL OR mv.practice = practice_filter)
            -- Archived filter (default excludes archived)
            AND mv.is_archived = COALESCE(is_archived_filter, FALSE)
            -- Cohort IDs filter
            AND (cohort_ids IS NULL OR cardinality(cohort_ids) = 0 OR mv.cohort_id = ANY(cohort_ids))
            -- Department IDs filter
            AND (department_ids IS NULL OR cardinality(department_ids) = 0 OR mv.department_id = ANY(department_ids))
            -- Scenario IDs filter (matches if any scenario overlaps)
            AND (scenario_ids_filter IS NULL OR cardinality(scenario_ids_filter) = 0 OR mv.scenario_ids && scenario_ids_filter)
            -- Infinite mode filter
            AND (infinite_mode_filter IS NULL OR mv.infinite_mode = infinite_mode_filter)
            -- Date range filter
            AND (date_from IS NULL OR mv.attempt_created_at >= date_from)
            AND (date_to IS NULL OR mv.attempt_created_at < date_to)
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
            CASE WHEN sort_by_field = 'date' AND sort_order_field = 'desc'
                 THEN attempt_created_at END DESC NULLS LAST,
            CASE WHEN sort_by_field = 'date' AND sort_order_field = 'asc'
                 THEN attempt_created_at END ASC NULLS LAST,
            -- Secondary sort by attempt_id for stability
            attempt_id DESC
        LIMIT page_limit_val
        OFFSET page_offset_val
    ),
    -- Aggregate items into array
    items_agg AS (
        SELECT COALESCE(
            ARRAY_AGG(
                (
                    attempt_id,
                    simulation_id,
                    profile_id,
                    cohort_id,
                    department_id,
                    practice,
                    infinite_mode,
                    attempt_created_at,
                    is_archived,
                    scenario_ids
                )::types.q_get_attempt_list_view_v4_item
                ORDER BY attempt_created_at DESC
            ),
            ARRAY[]::types.q_get_attempt_list_view_v4_item[]
        ) AS items
        FROM sorted
    ),
    -- Simulation filter options (from filtered, not sorted)
    simulation_options_cte AS (
        SELECT
            f.simulation_id::text AS value,
            f.simulation_id::text AS label,
            COUNT(DISTINCT f.attempt_id)::int AS count
        FROM filtered f
        WHERE f.simulation_id IS NOT NULL
        GROUP BY f.simulation_id
        ORDER BY count DESC, value
    ),
    simulation_options_agg AS (
        SELECT COALESCE(
            ARRAY_AGG(
                (value, label, count)::types.q_get_attempt_list_view_v4_option
            ),
            ARRAY[]::types.q_get_attempt_list_view_v4_option[]
        ) AS options
        FROM simulation_options_cte
    ),
    -- Scenario filter options (from filtered, unnested)
    scenario_options_cte AS (
        SELECT
            s_id::text AS value,
            s_id::text AS label,
            COUNT(DISTINCT f.attempt_id)::int AS count
        FROM filtered f
        CROSS JOIN LATERAL unnest(f.scenario_ids) AS s_id
        WHERE f.scenario_ids IS NOT NULL AND cardinality(f.scenario_ids) > 0
        GROUP BY s_id
        ORDER BY count DESC, value
    ),
    scenario_options_agg AS (
        SELECT COALESCE(
            ARRAY_AGG(
                (value, label, count)::types.q_get_attempt_list_view_v4_option
            ),
            ARRAY[]::types.q_get_attempt_list_view_v4_option[]
        ) AS options
        FROM scenario_options_cte
    ),
    -- Profile filter options (from filtered)
    profile_options_cte AS (
        SELECT
            f.profile_id::text AS value,
            f.profile_id::text AS label,
            COUNT(DISTINCT f.attempt_id)::int AS count
        FROM filtered f
        WHERE f.profile_id IS NOT NULL
        GROUP BY f.profile_id
        ORDER BY count DESC, value
    ),
    profile_options_agg AS (
        SELECT COALESCE(
            ARRAY_AGG(
                (value, label, count)::types.q_get_attempt_list_view_v4_option
            ),
            ARRAY[]::types.q_get_attempt_list_view_v4_option[]
        ) AS options
        FROM profile_options_cte
    )
    SELECT
        (SELECT items FROM items_agg),
        (SELECT total FROM counted),
        (SELECT options FROM simulation_options_agg),
        (SELECT options FROM scenario_options_agg),
        (SELECT options FROM profile_options_agg);
$$;
