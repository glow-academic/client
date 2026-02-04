-- ============================================================================
-- Query Function: api_get_analytics_profile_metrics_view_v4
-- Raw filtered access to mv_profile_metrics (no resource JOINs).
-- ============================================================================

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) AS sig
        FROM pg_proc
        WHERE proname = 'api_get_analytics_profile_metrics_view_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_analytics_profile_metrics_view_v4(%s)', r.sig);
    END LOOP;
END $$;

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT typname
        FROM pg_type
        WHERE typname LIKE 'q_get_analytics_profile_metrics_view_v4_%'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I CASCADE', r.typname);
    END LOOP;
END $$;

CREATE TYPE types.q_get_analytics_profile_metrics_view_v4_item AS (
    profile_id uuid,
    attempt_type text,
    is_archived boolean,
    total_attempts int,
    avg_score numeric,
    highest_score numeric,
    completion_pct numeric,
    first_attempt_pass_rate numeric,
    avg_messages_per_session numeric,
    avg_persona_response_sec numeric,
    session_efficiency numeric,
    total_time_minutes numeric,
    improvement_rate numeric,
    perfect_score_count int,
    quickest_pass_minutes numeric,
    first_attempt_at timestamptz,
    last_attempt_at timestamptz,
    simulation_ids uuid[],
    scenario_ids uuid[],
    cohort_ids uuid[]
);

CREATE OR REPLACE FUNCTION api_get_analytics_profile_metrics_view_v4(
    profile_id uuid DEFAULT NULL,
    profile_ids uuid[] DEFAULT NULL,
    cohort_ids uuid[] DEFAULT NULL,
    simulation_ids uuid[] DEFAULT NULL,
    scenario_ids uuid[] DEFAULT NULL,
    attempt_type_filter text DEFAULT NULL,
    is_archived_filter boolean DEFAULT FALSE,
    min_attempts int DEFAULT NULL,
    sort_by text DEFAULT 'avg_score',
    sort_order text DEFAULT 'desc',
    page_limit int DEFAULT 50,
    page_offset int DEFAULT 0
)
RETURNS TABLE (
    total_count int,
    items types.q_get_analytics_profile_metrics_view_v4_item[]
)
LANGUAGE sql
STABLE
AS $$
WITH params AS (
    SELECT
        profile_id AS profile_id,
        COALESCE(profile_ids, ARRAY[]::uuid[]) AS profile_ids,
        COALESCE(cohort_ids, ARRAY[]::uuid[]) AS cohort_ids,
        COALESCE(simulation_ids, ARRAY[]::uuid[]) AS simulation_ids,
        COALESCE(scenario_ids, ARRAY[]::uuid[]) AS scenario_ids,
        attempt_type_filter AS attempt_type_filter,
        COALESCE(is_archived_filter, FALSE) AS is_archived_filter,
        min_attempts AS min_attempts,
        COALESCE(sort_by, 'avg_score') AS sort_by,
        COALESCE(sort_order, 'desc') AS sort_order,
        COALESCE(page_limit, 50) AS page_limit,
        COALESCE(page_offset, 0) AS page_offset
),
filtered AS (
    SELECT
        mv.profile_id,
        mv.attempt_type,
        mv.is_archived,
        mv.total_attempts,
        mv.avg_score,
        mv.highest_score,
        mv.completion_pct,
        mv.first_attempt_pass_rate,
        mv.avg_messages_per_session,
        mv.avg_persona_response_sec,
        mv.session_efficiency,
        mv.total_time_minutes,
        mv.improvement_rate,
        mv.perfect_score_count,
        mv.quickest_pass_minutes,
        mv.first_attempt_at,
        mv.last_attempt_at,
        mv.simulation_ids,
        mv.scenario_ids,
        mv.cohort_ids
    FROM mv_profile_metrics mv
    CROSS JOIN params p
    WHERE
        (
            (p.profile_id IS NOT NULL AND mv.profile_id = p.profile_id)
            OR (p.profile_id IS NULL AND (cardinality(p.profile_ids) = 0 OR mv.profile_id = ANY(p.profile_ids)))
        )
        AND (cardinality(p.cohort_ids) = 0 OR mv.cohort_ids && p.cohort_ids)
        AND (cardinality(p.simulation_ids) = 0 OR mv.simulation_ids && p.simulation_ids)
        AND (cardinality(p.scenario_ids) = 0 OR mv.scenario_ids && p.scenario_ids)
        AND (p.attempt_type_filter IS NULL OR mv.attempt_type = p.attempt_type_filter)
        AND mv.is_archived = p.is_archived_filter
        AND (p.min_attempts IS NULL OR mv.total_attempts >= p.min_attempts)
),
counted AS (
    SELECT COUNT(*)::int AS total_count FROM filtered
),
sorted AS (
    SELECT *
    FROM filtered
    CROSS JOIN params p
    ORDER BY
        CASE WHEN p.sort_by = 'avg_score' AND p.sort_order = 'desc' THEN avg_score END DESC NULLS LAST,
        CASE WHEN p.sort_by = 'avg_score' AND p.sort_order = 'asc' THEN avg_score END ASC NULLS LAST,
        CASE WHEN p.sort_by = 'highest_score' AND p.sort_order = 'desc' THEN highest_score END DESC NULLS LAST,
        CASE WHEN p.sort_by = 'highest_score' AND p.sort_order = 'asc' THEN highest_score END ASC NULLS LAST,
        CASE WHEN p.sort_by = 'total_attempts' AND p.sort_order = 'desc' THEN total_attempts END DESC NULLS LAST,
        CASE WHEN p.sort_by = 'total_attempts' AND p.sort_order = 'asc' THEN total_attempts END ASC NULLS LAST,
        CASE WHEN p.sort_by = 'improvement' AND p.sort_order = 'desc' THEN improvement_rate END DESC NULLS LAST,
        CASE WHEN p.sort_by = 'improvement' AND p.sort_order = 'asc' THEN improvement_rate END ASC NULLS LAST,
        CASE WHEN p.sort_by = 'last_attempt_at' AND p.sort_order = 'desc' THEN last_attempt_at END DESC NULLS LAST,
        CASE WHEN p.sort_by = 'last_attempt_at' AND p.sort_order = 'asc' THEN last_attempt_at END ASC NULLS LAST,
        avg_score DESC NULLS LAST
    LIMIT (SELECT page_limit FROM params)
    OFFSET (SELECT page_offset FROM params)
),
items_agg AS (
    SELECT COALESCE(
        ARRAY_AGG(
            (
                profile_id,
                attempt_type,
                is_archived,
                total_attempts,
                avg_score,
                highest_score,
                completion_pct,
                first_attempt_pass_rate,
                avg_messages_per_session,
                avg_persona_response_sec,
                session_efficiency,
                total_time_minutes,
                improvement_rate,
                perfect_score_count,
                quickest_pass_minutes,
                first_attempt_at,
                last_attempt_at,
                simulation_ids,
                scenario_ids,
                cohort_ids
            )::types.q_get_analytics_profile_metrics_view_v4_item
        ),
        ARRAY[]::types.q_get_analytics_profile_metrics_view_v4_item[]
    ) AS items
    FROM sorted
)
SELECT
    (SELECT total_count FROM counted),
    (SELECT items FROM items_agg);
$$;
