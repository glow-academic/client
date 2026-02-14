-- ============================================================================
-- Query: get_activity_list_view
-- Purpose: Fetch daily activity data from mv_activity with declarative filters
-- Section: VIEWS/ACTIVITY/LIST
--
-- Includes:
-- - Filtering (date range, event_type)
-- - Sorting (by date_key)
-- - Pagination
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
        WHERE proname = 'api_get_activity_list_view_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_activity_list_view_v4(%s)', r.sig);
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
        WHERE typname LIKE 'q_get_activity_list_view_v4_%'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I CASCADE', r.typname);
    END LOOP;
END $$;

-- ============================================================================
-- Step 3: Create composite types
-- ============================================================================

CREATE TYPE types.q_get_activity_list_view_v4_item AS (
    date_key date,
    event_type text,
    event_count int,
    unique_profiles int,
    saved_count int,
    created_count int,
    duplicated_count int,
    uploaded_count int,
    deleted_count int,
    updated_count int
);

-- ============================================================================
-- Step 4: Create function
-- ============================================================================

CREATE OR REPLACE FUNCTION api_get_activity_list_view_v4(
    event_type_filter text DEFAULT NULL,
    date_from date DEFAULT NULL,
    date_to date DEFAULT NULL,
    sort_order_field text DEFAULT 'desc',
    page_limit_val int DEFAULT 1000,
    page_offset_val int DEFAULT 0
)
RETURNS TABLE (
    items types.q_get_activity_list_view_v4_item[],
    total_count int
)
LANGUAGE sql
STABLE
AS $$
    WITH
    filtered AS (
        SELECT mv.*
        FROM mv_activity mv
        WHERE
            (event_type_filter IS NULL OR mv.event_type = event_type_filter)
            AND (date_from IS NULL OR mv.date_key >= date_from)
            AND (date_to IS NULL OR mv.date_key <= date_to)
    ),
    counted AS (
        SELECT COUNT(*)::int AS total FROM filtered
    ),
    sorted AS (
        SELECT *
        FROM filtered
        ORDER BY
            CASE WHEN sort_order_field = 'asc' THEN date_key END ASC,
            CASE WHEN sort_order_field != 'asc' THEN date_key END DESC
        LIMIT page_limit_val
        OFFSET page_offset_val
    ),
    items_agg AS (
        SELECT COALESCE(
            ARRAY_AGG(
                (
                    date_key,
                    event_type,
                    event_count,
                    unique_profiles,
                    saved_count,
                    created_count,
                    duplicated_count,
                    uploaded_count,
                    deleted_count,
                    updated_count
                )::types.q_get_activity_list_view_v4_item
                ORDER BY
                    CASE WHEN sort_order_field = 'asc' THEN date_key END ASC,
                    CASE WHEN sort_order_field != 'asc' THEN date_key END DESC
            ),
            ARRAY[]::types.q_get_activity_list_view_v4_item[]
        ) AS items
        FROM sorted
    )
    SELECT
        (SELECT items FROM items_agg),
        (SELECT total FROM counted);
$$;
