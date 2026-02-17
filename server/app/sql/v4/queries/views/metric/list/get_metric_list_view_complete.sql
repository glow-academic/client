-- ============================================================================
-- Query: get_metric_list_view
-- Purpose: Fetch system metrics data from metrics_mv with declarative filters
-- Section: VIEWS/METRIC/LIST
--
-- Includes:
-- - Filtering (date range)
-- - Sorting (by date_hour)
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
        WHERE proname = 'api_get_metric_list_view_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_metric_list_view_v4(%s)', r.sig);
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
        WHERE typname LIKE 'q_get_metric_list_view_v4_%'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I CASCADE', r.typname);
    END LOOP;
END $$;

-- ============================================================================
-- Step 3: Create composite types
-- ============================================================================

CREATE TYPE types.q_get_metric_list_view_v4_item AS (
    date_hour timestamptz,
    sample_count int,
    avg_cpu_percent numeric,
    min_cpu_percent numeric,
    max_cpu_percent numeric,
    avg_latency_ms numeric,
    min_latency_ms numeric,
    max_latency_ms numeric,
    avg_memory_bytes bigint,
    min_memory_bytes bigint,
    max_memory_bytes bigint,
    max_requests_total int,
    max_errors_total int
);

-- ============================================================================
-- Step 4: Create function
-- ============================================================================

CREATE OR REPLACE FUNCTION api_get_metric_list_view_v4(
    date_from timestamptz DEFAULT '-infinity'::timestamptz,
    date_to timestamptz DEFAULT 'infinity'::timestamptz,
    sort_order_field text DEFAULT 'desc',
    page_limit_val int DEFAULT 1000,
    page_offset_val int DEFAULT 0
)
RETURNS TABLE (
    items types.q_get_metric_list_view_v4_item[],
    total_count int
)
LANGUAGE sql
STABLE
AS $$
    WITH
    filtered AS (
        SELECT mv.*
        FROM metrics_mv mv
        WHERE
            mv.date_hour >= date_from
            AND mv.date_hour <= date_to
    ),
    counted AS (
        SELECT COUNT(*)::int AS total FROM filtered
    ),
    sorted AS (
        SELECT *
        FROM filtered
        ORDER BY
            CASE WHEN sort_order_field = 'asc' THEN date_hour END ASC,
            CASE WHEN sort_order_field != 'asc' THEN date_hour END DESC
        LIMIT page_limit_val
        OFFSET page_offset_val
    ),
    items_agg AS (
        SELECT COALESCE(
            ARRAY_AGG(
                (
                    date_hour,
                    sample_count,
                    avg_cpu_percent,
                    min_cpu_percent,
                    max_cpu_percent,
                    avg_latency_ms,
                    min_latency_ms,
                    max_latency_ms,
                    avg_memory_bytes,
                    min_memory_bytes,
                    max_memory_bytes,
                    max_requests_total,
                    max_errors_total
                )::types.q_get_metric_list_view_v4_item
                ORDER BY
                    CASE WHEN sort_order_field = 'asc' THEN date_hour END ASC,
                    CASE WHEN sort_order_field != 'asc' THEN date_hour END DESC
            ),
            ARRAY[]::types.q_get_metric_list_view_v4_item[]
        ) AS items
        FROM sorted
    )
    SELECT
        (SELECT items FROM items_agg),
        (SELECT total FROM counted);
$$;
