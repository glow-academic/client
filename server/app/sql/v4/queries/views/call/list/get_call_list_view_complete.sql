-- ============================================================================
-- Query: get_call_list_view
-- Purpose: Fetch call-level data from mv_calls with declarative filters
-- Section: VIEWS/CALL/LIST
--
-- Includes:
-- - Filtering (run_id, run_ids batch)
-- - Ordering (by run_id, then created_at)
-- - Pagination
--
-- Note: Returns tool_id (resource ID) — name resolved in hydration layer.
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
        WHERE proname = 'api_get_call_list_view_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_call_list_view_v4(%s)', r.sig);
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
        WHERE typname LIKE 'q_get_call_list_view_v4_%'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I CASCADE', r.typname);
    END LOOP;
END $$;

-- ============================================================================
-- Step 3: Create composite types
-- ============================================================================

CREATE TYPE types.q_get_call_list_view_v4_item AS (
    call_id uuid,
    run_id uuid,
    call_created_at timestamptz,
    arguments_raw text,
    tool_id uuid
);

-- ============================================================================
-- Step 4: Create function
-- ============================================================================

CREATE OR REPLACE FUNCTION api_get_call_list_view_v4(
    run_id_filter uuid DEFAULT NULL,
    run_ids uuid[] DEFAULT NULL,
    page_limit_val int DEFAULT 10000,
    page_offset_val int DEFAULT 0
)
RETURNS TABLE (
    items types.q_get_call_list_view_v4_item[],
    total_count int
)
LANGUAGE sql
STABLE
AS $$
    WITH
    filtered AS (
        SELECT mv.*
        FROM mv_calls mv
        WHERE
            (run_id_filter IS NULL OR mv.run_id = run_id_filter)
            AND (run_ids IS NULL OR mv.run_id = ANY(run_ids))
    ),
    counted AS (
        SELECT COUNT(*)::int AS total FROM filtered
    ),
    sorted AS (
        SELECT *
        FROM filtered
        ORDER BY
            run_id,
            call_created_at
        LIMIT page_limit_val
        OFFSET page_offset_val
    ),
    items_agg AS (
        SELECT COALESCE(
            ARRAY_AGG(
                (
                    call_id,
                    run_id,
                    call_created_at,
                    arguments_raw,
                    tool_id
                )::types.q_get_call_list_view_v4_item
                ORDER BY run_id, call_created_at
            ),
            ARRAY[]::types.q_get_call_list_view_v4_item[]
        ) AS items
        FROM sorted
    )
    SELECT
        (SELECT items FROM items_agg),
        (SELECT total FROM counted);
$$;
