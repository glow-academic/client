-- ============================================================================
-- Query: get_test_list_view
-- Purpose: Fetch test-level data from test_mv with invocation completion counts
-- Section: VIEWS/TEST/LIST
--
-- Includes:
-- - Filtering (department_ids, eval_ids, archived, date range, search)
-- - Sorting (date asc/desc, name asc/desc)
-- - Pagination
-- - Filter options (eval_options)
--
-- Note: Returns resource IDs only. Metadata (names, descriptions) fetched via internal handlers.
-- ============================================================================

-- ============================================================================
-- Step 1: Drop existing function
-- ============================================================================

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) AS sig
        FROM pg_proc
        WHERE proname = 'api_get_test_list_view_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_test_list_view_v4(%s)', r.sig);
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
        WHERE typname LIKE 'q_get_test_list_view_v4_%'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I CASCADE', r.typname);
    END LOOP;
END $$;

-- ============================================================================
-- Step 3: Create composite types
-- ============================================================================

CREATE TYPE types.q_get_test_list_view_v4_item AS (
    -- Primary key
    test_id uuid,

    -- Resource IDs
    eval_id uuid,
    profile_id uuid,
    benchmark_id uuid,
    department_ids uuid[],

    -- Test metadata
    test_name text,
    test_description text,
    num_invocations int,
    num_invocations_completed int,

    -- Flags
    infinite_mode boolean,
    archived boolean,

    -- Timestamps
    test_created_at timestamptz
);

-- Filter option type for dropdowns
CREATE TYPE types.q_get_test_list_view_v4_option AS (
    value text,
    label text,
    count int
);

-- ============================================================================
-- Step 4: Create function
-- ============================================================================

CREATE OR REPLACE FUNCTION api_get_test_list_view_v4(
    -- Filters
    test_ids uuid[] DEFAULT NULL,
    department_ids uuid[] DEFAULT NULL,
    eval_ids uuid[] DEFAULT NULL,
    is_archived_filter boolean DEFAULT NULL,
    date_from timestamptz DEFAULT NULL,
    date_to timestamptz DEFAULT NULL,
    search_text text DEFAULT NULL,
    -- Sorting
    sort_by_field text DEFAULT 'date',
    sort_order_field text DEFAULT 'desc',
    -- Pagination
    page_limit_val int DEFAULT 50,
    page_offset_val int DEFAULT 0
)
RETURNS TABLE (
    items types.q_get_test_list_view_v4_item[],
    total_count int,
    eval_options types.q_get_test_list_view_v4_option[]
)
LANGUAGE sql
STABLE
AS $$
    WITH
    -- Apply all filters to test_mv
    filtered AS (
        SELECT
            tm.*,
            COALESCE(ic.num_completed, 0)::int AS num_invocations_completed
        FROM test_mv tm
        LEFT JOIN LATERAL (
            SELECT COUNT(*) FILTER (WHERE ti.invocation_completed) AS num_completed
            FROM test_invocation_mv ti
            WHERE ti.test_id = tm.test_id
        ) ic ON true
        WHERE
            -- Test IDs filter (exact match)
            (test_ids IS NULL OR cardinality(test_ids) = 0 OR tm.test_id = ANY(test_ids))
            -- Department IDs filter (array overlap)
            AND (department_ids IS NULL OR cardinality(department_ids) = 0 OR tm.department_ids && department_ids)
            -- Eval IDs filter
            AND (eval_ids IS NULL OR cardinality(eval_ids) = 0 OR tm.eval_id = ANY(eval_ids))
            -- Archived filter
            AND (is_archived_filter IS NULL OR tm.archived = is_archived_filter)
            -- Date range filter
            AND (date_from IS NULL OR tm.test_created_at >= date_from)
            AND (date_to IS NULL OR tm.test_created_at < date_to)
            -- Search filter
            AND (search_text IS NULL OR tm.test_name ILIKE '%' || search_text || '%')
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
                 THEN test_created_at END DESC NULLS LAST,
            CASE WHEN sort_by_field = 'date' AND sort_order_field = 'asc'
                 THEN test_created_at END ASC NULLS LAST,
            CASE WHEN sort_by_field = 'name' AND sort_order_field = 'desc'
                 THEN test_name END DESC NULLS LAST,
            CASE WHEN sort_by_field = 'name' AND sort_order_field = 'asc'
                 THEN test_name END ASC NULLS LAST,
            -- Secondary sort by test_id for stability
            test_id DESC
        LIMIT page_limit_val
        OFFSET page_offset_val
    ),
    -- Aggregate items into array
    items_agg AS (
        SELECT COALESCE(
            ARRAY_AGG(
                (
                    test_id,
                    eval_id,
                    profile_id,
                    benchmark_id,
                    department_ids,
                    test_name,
                    test_description,
                    num_invocations,
                    num_invocations_completed,
                    infinite_mode,
                    archived,
                    test_created_at
                )::types.q_get_test_list_view_v4_item
                ORDER BY test_created_at DESC
            ),
            ARRAY[]::types.q_get_test_list_view_v4_item[]
        ) AS items
        FROM sorted
    ),
    -- Eval filter options (from filtered, not sorted)
    eval_options_cte AS (
        SELECT
            f.eval_id::text AS value,
            f.eval_id::text AS label,
            COUNT(DISTINCT f.test_id)::int AS count
        FROM filtered f
        WHERE f.eval_id IS NOT NULL
        GROUP BY f.eval_id
        ORDER BY count DESC, value
    ),
    eval_options_agg AS (
        SELECT COALESCE(
            ARRAY_AGG(
                (value, label, count)::types.q_get_test_list_view_v4_option
            ),
            ARRAY[]::types.q_get_test_list_view_v4_option[]
        ) AS options
        FROM eval_options_cte
    )
    SELECT
        (SELECT items FROM items_agg),
        (SELECT total FROM counted),
        (SELECT options FROM eval_options_agg);
$$;
