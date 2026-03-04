-- ============================================================================
-- Query: get_grant_list_view
-- Purpose: Fetch grant-level data from grants_mv with declarative filters
-- Section: VIEWS/GRANT/LIST
--
-- Includes:
-- - Filtering (grantor_id, emulated_id)
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
        WHERE proname = 'api_get_grant_list_view_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_grant_list_view_v4(%s)', r.sig);
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
        WHERE typname LIKE 'q_get_grant_list_view_v4_%'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I CASCADE', r.typname);
    END LOOP;
END $$;

-- ============================================================================
-- Step 3: Create composite types
-- ============================================================================

CREATE TYPE types.q_get_grant_list_view_v4_item AS (
    grant_id uuid,
    grantor_id uuid,
    emulation_id uuid,
    emulated_id uuid,
    grant_session_id uuid,
    emulation_session_id uuid,
    expires_at timestamptz,
    created_at timestamptz,
    active boolean,
    mcp boolean,
    generated boolean
);

-- ============================================================================
-- Step 4: Create function
-- ============================================================================

CREATE OR REPLACE FUNCTION api_get_grant_list_view_v4(
    grantor_id_filter uuid DEFAULT NULL,
    emulated_id_filter uuid DEFAULT NULL,
    page_limit_val int DEFAULT 10000,
    page_offset_val int DEFAULT 0
)
RETURNS TABLE (
    items types.q_get_grant_list_view_v4_item[],
    total_count int
)
LANGUAGE sql
STABLE
AS $$
    WITH
    filtered AS (
        SELECT mv.*
        FROM grants_mv mv
        WHERE
            (grantor_id_filter IS NULL OR mv.grantor_id = grantor_id_filter)
            AND (emulated_id_filter IS NULL OR mv.emulated_id = emulated_id_filter)
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
                    grant_id,
                    grantor_id,
                    emulation_id,
                    emulated_id,
                    grant_session_id,
                    emulation_session_id,
                    expires_at,
                    created_at,
                    active,
                    mcp,
                    generated
                )::types.q_get_grant_list_view_v4_item
                ORDER BY created_at DESC
            ),
            ARRAY[]::types.q_get_grant_list_view_v4_item[]
        ) AS items
        FROM sorted
    )
    SELECT
        (SELECT items FROM items_agg),
        (SELECT total FROM counted);
$$;
