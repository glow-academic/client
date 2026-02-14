-- ============================================================================
-- Query: get_group_list_view
-- Purpose: Fetch group-level data from mv_groups with declarative filters
-- Section: VIEWS/GROUP/LIST
--
-- Includes:
-- - Filtering (group_ids, session_id, date range)
-- - Sorting (date asc/desc)
-- - Pagination
--
-- Note: Returns IDs + timestamps only. Aggregates computed in Python service layer.
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
        WHERE proname = 'api_get_group_list_view_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_group_list_view_v4(%s)', r.sig);
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
        WHERE typname LIKE 'q_get_group_list_view_v4_%'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I CASCADE', r.typname);
    END LOOP;
END $$;

-- ============================================================================
-- Step 3: Create composite types
-- ============================================================================

CREATE TYPE types.q_get_group_list_view_v4_item AS (
    group_id uuid,
    session_id uuid,
    group_created_at timestamptz,
    trace_id text,
    group_name text,
    active boolean
);

-- ============================================================================
-- Step 4: Create function
-- ============================================================================

CREATE OR REPLACE FUNCTION api_get_group_list_view_v4(
    group_ids uuid[] DEFAULT NULL,
    session_id_filter uuid DEFAULT NULL,
    date_from timestamptz DEFAULT NULL,
    date_to timestamptz DEFAULT NULL,
    sort_by_field text DEFAULT 'date',
    sort_order_field text DEFAULT 'desc',
    page_limit_val int DEFAULT 50,
    page_offset_val int DEFAULT 0
)
RETURNS TABLE (
    items types.q_get_group_list_view_v4_item[],
    total_count int
)
LANGUAGE sql
STABLE
AS $$
    WITH
    filtered AS (
        SELECT mv.*
        FROM mv_groups mv
        WHERE
            (group_ids IS NULL OR mv.group_id = ANY(group_ids))
            AND (session_id_filter IS NULL OR mv.session_id = session_id_filter)
            AND (date_from IS NULL OR mv.group_created_at >= date_from)
            AND (date_to IS NULL OR mv.group_created_at < date_to)
    ),
    counted AS (
        SELECT COUNT(*)::int AS total FROM filtered
    ),
    sorted AS (
        SELECT *
        FROM filtered
        ORDER BY
            CASE WHEN sort_by_field = 'date' AND sort_order_field = 'desc'
                 THEN group_created_at END DESC NULLS LAST,
            CASE WHEN sort_by_field = 'date' AND sort_order_field = 'asc'
                 THEN group_created_at END ASC NULLS LAST,
            group_id DESC
        LIMIT page_limit_val
        OFFSET page_offset_val
    ),
    items_agg AS (
        SELECT COALESCE(
            ARRAY_AGG(
                (
                    group_id,
                    session_id,
                    group_created_at,
                    trace_id,
                    group_name,
                    active
                )::types.q_get_group_list_view_v4_item
                ORDER BY group_created_at DESC
            ),
            ARRAY[]::types.q_get_group_list_view_v4_item[]
        ) AS items
        FROM sorted
    )
    SELECT
        (SELECT items FROM items_agg),
        (SELECT total FROM counted);
$$;
