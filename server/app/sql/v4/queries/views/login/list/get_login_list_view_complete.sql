-- ============================================================================
-- Query: get_login_list_view
-- Purpose: Fetch login-level data from mv_logins with declarative filters
-- Section: VIEWS/LOGIN/LIST
--
-- Includes:
-- - Filtering (profile_id, active, date range)
-- - Sorting (by last_login or created_at)
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
        WHERE proname = 'api_get_login_list_view_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_login_list_view_v4(%s)', r.sig);
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
        WHERE typname LIKE 'q_get_login_list_view_v4_%'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I CASCADE', r.typname);
    END LOOP;
END $$;

-- ============================================================================
-- Step 3: Create composite types
-- ============================================================================

CREATE TYPE types.q_get_login_list_view_v4_item AS (
    login_id uuid,
    profile_id uuid,
    last_login timestamptz,
    login_created_at timestamptz,
    active boolean,
    generated boolean,
    mcp boolean,
    call_id uuid
);

-- ============================================================================
-- Step 4: Create function
-- ============================================================================

CREATE OR REPLACE FUNCTION api_get_login_list_view_v4(
    profile_id_filter uuid DEFAULT NULL,
    active_filter boolean DEFAULT NULL,
    date_from timestamptz DEFAULT '-infinity'::timestamptz,
    date_to timestamptz DEFAULT 'infinity'::timestamptz,
    sort_order_field text DEFAULT 'desc',
    page_limit_val int DEFAULT 50,
    page_offset_val int DEFAULT 0
)
RETURNS TABLE (
    items types.q_get_login_list_view_v4_item[],
    total_count int
)
LANGUAGE sql
STABLE
AS $$
    WITH
    filtered AS (
        SELECT mv.*
        FROM mv_logins mv
        WHERE
            (profile_id_filter IS NULL OR mv.profile_id = profile_id_filter)
            AND (active_filter IS NULL OR mv.active = active_filter)
            AND mv.login_created_at >= date_from
            AND mv.login_created_at <= date_to
    ),
    counted AS (
        SELECT COUNT(*)::int AS total FROM filtered
    ),
    sorted AS (
        SELECT *
        FROM filtered
        ORDER BY
            CASE WHEN sort_order_field = 'asc' THEN last_login END ASC,
            CASE WHEN sort_order_field != 'asc' THEN last_login END DESC
        LIMIT page_limit_val
        OFFSET page_offset_val
    ),
    items_agg AS (
        SELECT COALESCE(
            ARRAY_AGG(
                (
                    login_id,
                    profile_id,
                    last_login,
                    login_created_at,
                    active,
                    generated,
                    mcp,
                    call_id
                )::types.q_get_login_list_view_v4_item
                ORDER BY
                    CASE WHEN sort_order_field = 'asc' THEN last_login END ASC,
                    CASE WHEN sort_order_field != 'asc' THEN last_login END DESC
            ),
            ARRAY[]::types.q_get_login_list_view_v4_item[]
        ) AS items
        FROM sorted
    )
    SELECT
        (SELECT items FROM items_agg),
        (SELECT total FROM counted);
$$;
