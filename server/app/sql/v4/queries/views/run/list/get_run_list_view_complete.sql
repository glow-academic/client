-- ============================================================================
-- Query: get_run_list_view
-- Purpose: Fetch run-level data from mv_runs with declarative filters
-- Section: VIEWS/RUN/LIST
--
-- Includes:
-- - Filtering (group_id, group_ids batch, date range)
-- - Sorting (date asc/desc)
-- - Pagination
--
-- Note: Returns run data with flat pricing columns. Costs computed in Python.
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
        WHERE proname = 'api_get_run_list_view_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_run_list_view_v4(%s)', r.sig);
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
        WHERE typname LIKE 'q_get_run_list_view_v4_%'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I CASCADE', r.typname);
    END LOOP;
END $$;

-- ============================================================================
-- Step 3: Create composite types
-- ============================================================================

CREATE TYPE types.q_get_run_list_view_v4_item AS (
    run_id uuid,
    group_id uuid,
    input_tokens int,
    output_tokens int,
    cached_input_tokens int,
    run_created_at timestamptz,
    agent_ids uuid[],
    model_ids uuid[],
    provider_ids uuid[],
    input_pricing_count int,
    input_pricing_unit_id uuid,
    input_pricing_pricing_id uuid,
    output_pricing_count int,
    output_pricing_unit_id uuid,
    output_pricing_pricing_id uuid,
    cached_pricing_count int,
    cached_pricing_unit_id uuid,
    cached_pricing_pricing_id uuid
);

-- ============================================================================
-- Step 4: Create function
-- ============================================================================

CREATE OR REPLACE FUNCTION api_get_run_list_view_v4(
    group_id_filter uuid DEFAULT NULL,
    group_ids uuid[] DEFAULT NULL,
    date_from timestamptz DEFAULT NULL,
    date_to timestamptz DEFAULT NULL,
    sort_by_field text DEFAULT 'date',
    sort_order_field text DEFAULT 'desc',
    page_limit_val int DEFAULT 50,
    page_offset_val int DEFAULT 0
)
RETURNS TABLE (
    items types.q_get_run_list_view_v4_item[],
    total_count int
)
LANGUAGE sql
STABLE
AS $$
    WITH
    filtered AS (
        SELECT mv.*
        FROM mv_runs mv
        WHERE
            (group_id_filter IS NULL OR mv.group_id = group_id_filter)
            AND (group_ids IS NULL OR mv.group_id = ANY(group_ids))
            AND (date_from IS NULL OR mv.run_created_at >= date_from)
            AND (date_to IS NULL OR mv.run_created_at < date_to)
    ),
    counted AS (
        SELECT COUNT(*)::int AS total FROM filtered
    ),
    sorted AS (
        SELECT *
        FROM filtered
        ORDER BY
            CASE WHEN sort_by_field = 'date' AND sort_order_field = 'desc'
                 THEN run_created_at END DESC NULLS LAST,
            CASE WHEN sort_by_field = 'date' AND sort_order_field = 'asc'
                 THEN run_created_at END ASC NULLS LAST,
            run_id DESC
        LIMIT page_limit_val
        OFFSET page_offset_val
    ),
    items_agg AS (
        SELECT COALESCE(
            ARRAY_AGG(
                (
                    run_id,
                    group_id,
                    input_tokens,
                    output_tokens,
                    cached_input_tokens,
                    run_created_at,
                    agent_ids,
                    model_ids,
                    provider_ids,
                    input_pricing_count,
                    input_pricing_unit_id,
                    input_pricing_pricing_id,
                    output_pricing_count,
                    output_pricing_unit_id,
                    output_pricing_pricing_id,
                    cached_pricing_count,
                    cached_pricing_unit_id,
                    cached_pricing_pricing_id
                )::types.q_get_run_list_view_v4_item
                ORDER BY run_created_at DESC
            ),
            ARRAY[]::types.q_get_run_list_view_v4_item[]
        ) AS items
        FROM sorted
    )
    SELECT
        (SELECT items FROM items_agg),
        (SELECT total FROM counted);
$$;
