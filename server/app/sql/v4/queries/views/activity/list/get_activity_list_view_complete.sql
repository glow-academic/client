-- ============================================================================
-- Query: get_activity_list_view
-- Purpose: Fetch activity-level data from activity_mv with declarative filters
-- Section: VIEWS/ACTIVITY/LIST
--
-- Includes:
-- - Filtering (profile_id, session_id)
-- - Ordering (by created_at)
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
    activity_id uuid,
    profile_id uuid,
    session_id uuid,
    last_active timestamptz,
    created_at timestamptz
);

-- ============================================================================
-- Step 4: Create function
-- ============================================================================

CREATE OR REPLACE FUNCTION api_get_activity_list_view_v4(
    profile_id_filter uuid DEFAULT NULL,
    session_id_filter uuid DEFAULT NULL,
    page_limit_val int DEFAULT 10000,
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
        FROM activity_mv mv
        WHERE
            (profile_id_filter IS NULL OR mv.profile_id = profile_id_filter)
            AND (session_id_filter IS NULL OR mv.session_id = session_id_filter)
    ),
    counted AS (
        SELECT COUNT(*)::int AS total FROM filtered
    ),
    sorted AS (
        SELECT *
        FROM filtered
        ORDER BY created_at DESC
        LIMIT page_limit_val
        OFFSET page_offset_val
    ),
    items_agg AS (
        SELECT COALESCE(
            ARRAY_AGG(
                (
                    activity_id,
                    profile_id,
                    session_id,
                    last_active,
                    created_at
                )::types.q_get_activity_list_view_v4_item
                ORDER BY created_at DESC
            ),
            ARRAY[]::types.q_get_activity_list_view_v4_item[]
        ) AS items
        FROM sorted
    )
    SELECT
        (SELECT items FROM items_agg),
        (SELECT total FROM counted);
$$;
