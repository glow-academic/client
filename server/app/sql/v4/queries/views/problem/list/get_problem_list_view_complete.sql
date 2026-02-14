-- ============================================================================
-- Query: get_problem_list_view
-- Purpose: Fetch problem-level data from mv_problems with declarative filters
-- Section: VIEWS/PROBLEM/LIST
--
-- Includes:
-- - Filtering (profile_id, resolved, date range)
-- - Sorting (by created_at)
-- - Pagination
--
-- Note: Returns profile_id only — name resolved in hydration layer.
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
        WHERE proname = 'api_get_problem_list_view_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_problem_list_view_v4(%s)', r.sig);
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
        WHERE typname LIKE 'q_get_problem_list_view_v4_%'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I CASCADE', r.typname);
    END LOOP;
END $$;

-- ============================================================================
-- Step 3: Create composite types
-- ============================================================================

CREATE TYPE types.q_get_problem_list_view_v4_item AS (
    problem_id uuid,
    type text,
    message text,
    resolved boolean,
    problem_created_at timestamptz,
    problem_updated_at timestamptz,
    profile_id uuid
);

-- ============================================================================
-- Step 4: Create function
-- ============================================================================

CREATE OR REPLACE FUNCTION api_get_problem_list_view_v4(
    profile_id_filter uuid DEFAULT NULL,
    resolved_filter boolean DEFAULT NULL,
    date_from timestamptz DEFAULT '-infinity'::timestamptz,
    date_to timestamptz DEFAULT 'infinity'::timestamptz,
    sort_order_field text DEFAULT 'desc',
    page_limit_val int DEFAULT 50,
    page_offset_val int DEFAULT 0
)
RETURNS TABLE (
    items types.q_get_problem_list_view_v4_item[],
    total_count int
)
LANGUAGE sql
STABLE
AS $$
    WITH
    filtered AS (
        SELECT mv.*
        FROM mv_problems mv
        WHERE
            (profile_id_filter IS NULL OR mv.profile_id = profile_id_filter)
            AND (resolved_filter IS NULL OR mv.resolved = resolved_filter)
            AND mv.problem_created_at >= date_from
            AND mv.problem_created_at <= date_to
    ),
    counted AS (
        SELECT COUNT(*)::int AS total FROM filtered
    ),
    sorted AS (
        SELECT *
        FROM filtered
        ORDER BY
            CASE WHEN sort_order_field = 'asc' THEN problem_created_at END ASC,
            CASE WHEN sort_order_field != 'asc' THEN problem_created_at END DESC
        LIMIT page_limit_val
        OFFSET page_offset_val
    ),
    items_agg AS (
        SELECT COALESCE(
            ARRAY_AGG(
                (
                    problem_id,
                    type,
                    message,
                    resolved,
                    problem_created_at,
                    problem_updated_at,
                    profile_id
                )::types.q_get_problem_list_view_v4_item
                ORDER BY
                    CASE WHEN sort_order_field = 'asc' THEN problem_created_at END ASC,
                    CASE WHEN sort_order_field != 'asc' THEN problem_created_at END DESC
            ),
            ARRAY[]::types.q_get_problem_list_view_v4_item[]
        ) AS items
        FROM sorted
    )
    SELECT
        (SELECT items FROM items_agg),
        (SELECT total FROM counted);
$$;
