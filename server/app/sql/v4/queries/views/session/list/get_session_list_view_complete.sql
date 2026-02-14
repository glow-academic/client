-- ============================================================================
-- Query: get_session_list_view
-- Purpose: Fetch session-level data from mv_sessions with declarative filters
-- Section: VIEWS/SESSION/LIST
--
-- Includes:
-- - Filtering (session_ids, profile_id, active, date range)
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
        WHERE proname = 'api_get_session_list_view_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_session_list_view_v4(%s)', r.sig);
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
        WHERE typname LIKE 'q_get_session_list_view_v4_%'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I CASCADE', r.typname);
    END LOOP;
END $$;

-- ============================================================================
-- Step 3: Create composite types
-- ============================================================================

CREATE TYPE types.q_get_session_list_view_v4_item AS (
    session_id uuid,
    profile_id uuid,
    session_created_at timestamptz,
    active boolean
);

-- ============================================================================
-- Step 4: Create function
-- ============================================================================

CREATE OR REPLACE FUNCTION api_get_session_list_view_v4(
    session_ids uuid[] DEFAULT NULL,
    profile_id_filter uuid DEFAULT NULL,
    profile_ids_filter uuid[] DEFAULT NULL,
    active_filter boolean DEFAULT NULL,
    date_from timestamptz DEFAULT NULL,
    date_to timestamptz DEFAULT NULL,
    sort_by_field text DEFAULT 'date',
    sort_order_field text DEFAULT 'desc',
    page_limit_val int DEFAULT 50,
    page_offset_val int DEFAULT 0
)
RETURNS TABLE (
    items types.q_get_session_list_view_v4_item[],
    total_count int
)
LANGUAGE sql
STABLE
AS $$
    WITH
    filtered AS (
        SELECT mv.*
        FROM mv_sessions mv
        WHERE
            (session_ids IS NULL OR mv.session_id = ANY(session_ids))
            AND (profile_id_filter IS NULL OR mv.profile_id = profile_id_filter)
            AND (profile_ids_filter IS NULL OR mv.profile_id = ANY(profile_ids_filter))
            AND (active_filter IS NULL OR mv.active = active_filter)
            AND (date_from IS NULL OR mv.session_created_at >= date_from)
            AND (date_to IS NULL OR mv.session_created_at < date_to)
    ),
    counted AS (
        SELECT COUNT(*)::int AS total FROM filtered
    ),
    sorted AS (
        SELECT *
        FROM filtered
        ORDER BY
            CASE WHEN sort_by_field = 'date' AND sort_order_field = 'desc'
                 THEN session_created_at END DESC NULLS LAST,
            CASE WHEN sort_by_field = 'date' AND sort_order_field = 'asc'
                 THEN session_created_at END ASC NULLS LAST,
            session_id DESC
        LIMIT page_limit_val
        OFFSET page_offset_val
    ),
    items_agg AS (
        SELECT COALESCE(
            ARRAY_AGG(
                (
                    session_id,
                    profile_id,
                    session_created_at,
                    active
                )::types.q_get_session_list_view_v4_item
                ORDER BY session_created_at DESC
            ),
            ARRAY[]::types.q_get_session_list_view_v4_item[]
        ) AS items
        FROM sorted
    )
    SELECT
        (SELECT items FROM items_agg),
        (SELECT total FROM counted);
$$;
