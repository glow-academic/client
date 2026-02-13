-- ============================================================================
-- Query: get_activity_daily_view
-- Purpose: Fetch daily activity data from mv_activity_daily with pagination
-- Section: VIEWS/ACTIVITY/DAILY
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
        WHERE proname = 'api_get_activity_daily_view_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_activity_daily_view_v4(%s)', r.sig);
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
        WHERE typname LIKE 'q_get_activity_daily_view_v4_%'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I CASCADE', r.typname);
    END LOOP;
END $$;

-- ============================================================================
-- Step 3: Create composite types
-- ============================================================================

CREATE TYPE types.q_get_activity_daily_view_v4_item AS (
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

CREATE OR REPLACE FUNCTION api_get_activity_daily_view_v4(
    event_type_filter text DEFAULT NULL,
    date_from date DEFAULT NULL,
    date_to date DEFAULT NULL,
    page_limit int DEFAULT 30,
    page_offset int DEFAULT 0
)
RETURNS TABLE (
    items types.q_get_activity_daily_view_v4_item[],
    total_count bigint
)
LANGUAGE sql
STABLE
AS $$
    WITH
    filtered AS (
        SELECT mv.*
        FROM mv_activity_daily mv
        WHERE (event_type_filter IS NULL OR mv.event_type LIKE '%' || event_type_filter || '%')
          AND (date_from IS NULL OR mv.date_key >= date_from)
          AND (date_to IS NULL OR mv.date_key <= date_to)
    ),
    counted AS (
        SELECT COUNT(*)::bigint AS total_count FROM filtered
    ),
    paged AS (
        SELECT mv.*
        FROM filtered mv
        ORDER BY mv.date_key DESC, mv.event_count DESC
        LIMIT page_limit OFFSET page_offset
    ),
    items_agg AS (
        SELECT COALESCE(
            ARRAY_AGG(
                (
                    p.date_key,
                    p.event_type,
                    p.event_count,
                    p.unique_profiles,
                    p.saved_count,
                    p.created_count,
                    p.duplicated_count,
                    p.uploaded_count,
                    p.deleted_count,
                    p.updated_count
                )::types.q_get_activity_daily_view_v4_item
                ORDER BY p.date_key DESC, p.event_count DESC
            ),
            ARRAY[]::types.q_get_activity_daily_view_v4_item[]
        ) AS items
        FROM paged p
    )
    SELECT
        (SELECT items FROM items_agg) AS items,
        (SELECT total_count FROM counted) AS total_count;
$$;
