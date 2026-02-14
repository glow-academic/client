-- ============================================================================
-- Query: get_benchmark_tests_view
-- Purpose: Fetch test-level data from mv_benchmark_tests with declarative filters
-- Section: VIEWS/BENCHMARK/TESTS
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
        WHERE proname = 'api_get_benchmark_tests_view_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_benchmark_tests_view_v4(%s)', r.sig);
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
        WHERE typname LIKE 'q_get_benchmark_tests_view_v4_%'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I CASCADE', r.typname);
    END LOOP;
END $$;

-- ============================================================================
-- Step 3: Create composite types
-- ============================================================================

CREATE TYPE types.q_get_benchmark_tests_view_v4_item AS (
    -- Primary key
    test_id uuid,

    -- Resource IDs (metadata fetched via internal handlers)
    eval_id uuid,
    profile_id uuid,
    department_ids uuid[],

    -- Flags
    infinite_mode boolean,
    archived boolean,

    -- Timestamps
    created_at timestamptz
);

-- ============================================================================
-- Step 4: Create function
-- ============================================================================

CREATE OR REPLACE FUNCTION api_get_benchmark_tests_view_v4(
    test_ids uuid[] DEFAULT NULL,
    eval_id_filter uuid DEFAULT NULL,
    eval_ids_filter uuid[] DEFAULT NULL,
    profile_id_filter uuid DEFAULT NULL,
    archived_filter boolean DEFAULT NULL,
    department_ids_filter uuid[] DEFAULT NULL,
    date_from_filter timestamptz DEFAULT NULL,
    date_to_filter timestamptz DEFAULT NULL,
    sort_by_field text DEFAULT 'date',
    sort_order_field text DEFAULT 'desc',
    page_limit_val int DEFAULT 50,
    page_offset_val int DEFAULT 0
)
RETURNS TABLE (
    items types.q_get_benchmark_tests_view_v4_item[],
    total_count bigint
)
LANGUAGE sql
STABLE
AS $$
    WITH
    -- Fetch from MV with declarative filters
    mv_data AS (
        SELECT mv.*
        FROM mv_benchmark_tests mv
        WHERE (test_ids IS NULL OR mv.test_id = ANY(test_ids))
          AND (eval_id_filter IS NULL OR mv.eval_id = eval_id_filter)
          AND (eval_ids_filter IS NULL OR mv.eval_id = ANY(eval_ids_filter))
          AND (profile_id_filter IS NULL OR mv.profile_id = profile_id_filter)
          AND (archived_filter IS NULL OR mv.archived = archived_filter)
          AND (department_ids_filter IS NULL OR mv.department_ids && department_ids_filter OR mv.department_ids = ARRAY[]::uuid[])
          AND (date_from_filter IS NULL OR mv.test_created_at >= date_from_filter)
          AND (date_to_filter IS NULL OR mv.test_created_at < date_to_filter)
    ),
    -- Count total matching rows (before pagination)
    count_data AS (
        SELECT COUNT(*)::bigint AS total_count FROM mv_data
    ),
    -- No resource JOINs needed - all metadata fetched via internal handlers
    -- Aggregates derived in service layer from invocations
    with_resources AS (
        SELECT
            mv.test_id,
            mv.eval_id,
            mv.profile_id,
            mv.department_ids,
            mv.infinite_mode,
            mv.archived,
            mv.test_created_at AS created_at
        FROM mv_data mv
        ORDER BY
            CASE WHEN sort_order_field = 'desc' THEN mv.test_created_at END DESC,
            CASE WHEN sort_order_field = 'asc' THEN mv.test_created_at END ASC
        LIMIT page_limit_val OFFSET page_offset_val
    ),
    -- Aggregate into array
    items_agg AS (
        SELECT COALESCE(
            ARRAY_AGG(
                (
                    test_id,
                    eval_id,
                    profile_id,
                    department_ids,
                    infinite_mode,
                    archived,
                    created_at
                )::types.q_get_benchmark_tests_view_v4_item
            ),
            ARRAY[]::types.q_get_benchmark_tests_view_v4_item[]
        ) AS items
        FROM with_resources
    )
    SELECT ia.items, cd.total_count
    FROM items_agg ia
    CROSS JOIN count_data cd;
$$;
