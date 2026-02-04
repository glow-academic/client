-- ============================================================================
-- Query Function: api_get_analytics_daily_metrics_view_v4
-- Raw filtered access to mv_daily_metrics (no resource JOINs).
-- ============================================================================

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) AS sig
        FROM pg_proc
        WHERE proname = 'api_get_analytics_daily_metrics_view_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_analytics_daily_metrics_view_v4(%s)', r.sig);
    END LOOP;
END $$;

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT typname
        FROM pg_type
        WHERE typname LIKE 'q_get_analytics_daily_metrics_view_v4_%'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I CASCADE', r.typname);
    END LOOP;
END $$;

CREATE TYPE types.q_get_analytics_daily_metrics_view_v4_item AS (
    date_key date,
    cohort_id uuid,
    simulation_id uuid,
    attempt_type text,
    is_archived boolean,
    attempt_count int,
    unique_profiles int,
    completed_count int,
    passed_count int,
    avg_score numeric,
    total_time_seconds int,
    avg_messages numeric
);

CREATE OR REPLACE FUNCTION api_get_analytics_daily_metrics_view_v4(
    cohort_ids uuid[] DEFAULT NULL,
    simulation_ids uuid[] DEFAULT NULL,
    attempt_type_filter text DEFAULT NULL,
    is_archived_filter boolean DEFAULT FALSE,
    date_from date DEFAULT NULL,
    date_to date DEFAULT NULL,
    sort_by text DEFAULT 'date',
    sort_order text DEFAULT 'asc',
    page_limit int DEFAULT 365,
    page_offset int DEFAULT 0
)
RETURNS TABLE (
    total_count int,
    items types.q_get_analytics_daily_metrics_view_v4_item[]
)
LANGUAGE sql
STABLE
AS $$
WITH params AS (
    SELECT
        COALESCE(cohort_ids, ARRAY[]::uuid[]) AS cohort_ids,
        COALESCE(simulation_ids, ARRAY[]::uuid[]) AS simulation_ids,
        attempt_type_filter AS attempt_type_filter,
        COALESCE(is_archived_filter, FALSE) AS is_archived_filter,
        date_from AS date_from,
        date_to AS date_to,
        COALESCE(sort_by, 'date') AS sort_by,
        COALESCE(sort_order, 'asc') AS sort_order,
        COALESCE(page_limit, 365) AS page_limit,
        COALESCE(page_offset, 0) AS page_offset
),
filtered AS (
    SELECT
        mv.date_key,
        mv.cohort_id,
        mv.simulation_id,
        mv.attempt_type,
        mv.is_archived,
        mv.attempt_count,
        mv.unique_profiles,
        mv.completed_count,
        mv.passed_count,
        mv.avg_score,
        mv.total_time_seconds,
        mv.avg_messages
    FROM mv_daily_metrics mv
    CROSS JOIN params p
    WHERE
        (cardinality(p.cohort_ids) = 0 OR mv.cohort_id = ANY(p.cohort_ids))
        AND (cardinality(p.simulation_ids) = 0 OR mv.simulation_id = ANY(p.simulation_ids))
        AND (p.attempt_type_filter IS NULL OR mv.attempt_type = p.attempt_type_filter)
        AND mv.is_archived = p.is_archived_filter
        AND (p.date_from IS NULL OR mv.date_key >= p.date_from)
        AND (p.date_to IS NULL OR mv.date_key < p.date_to)
),
counted AS (
    SELECT COUNT(*)::int AS total_count FROM filtered
),
sorted AS (
    SELECT *
    FROM filtered
    CROSS JOIN params p
    ORDER BY
        CASE WHEN p.sort_by = 'date' AND p.sort_order = 'asc' THEN date_key END ASC NULLS LAST,
        CASE WHEN p.sort_by = 'date' AND p.sort_order = 'desc' THEN date_key END DESC NULLS LAST,
        CASE WHEN p.sort_by = 'avg_score' AND p.sort_order = 'desc' THEN avg_score END DESC NULLS LAST,
        CASE WHEN p.sort_by = 'avg_score' AND p.sort_order = 'asc' THEN avg_score END ASC NULLS LAST,
        date_key ASC
    LIMIT (SELECT page_limit FROM params)
    OFFSET (SELECT page_offset FROM params)
),
items_agg AS (
    SELECT COALESCE(
        ARRAY_AGG(
            (
                date_key,
                cohort_id,
                simulation_id,
                attempt_type,
                is_archived,
                attempt_count,
                unique_profiles,
                completed_count,
                passed_count,
                avg_score,
                total_time_seconds,
                avg_messages
            )::types.q_get_analytics_daily_metrics_view_v4_item
        ),
        ARRAY[]::types.q_get_analytics_daily_metrics_view_v4_item[]
    ) AS items
    FROM sorted
)
SELECT
    (SELECT total_count FROM counted),
    (SELECT items FROM items_agg);
$$;
