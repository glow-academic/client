-- ============================================================================
-- Query Function: api_get_analytics_first_attempt_pass_view_v4
-- Earliest attempt per (profile_id, simulation_id) all-time; then date window.
-- ============================================================================

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) AS sig
        FROM pg_proc
        WHERE proname = 'api_get_analytics_first_attempt_pass_view_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_analytics_first_attempt_pass_view_v4(%s)', r.sig);
    END LOOP;
END $$;

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT typname
        FROM pg_type
        WHERE typname LIKE 'q_get_analytics_first_attempt_pass_view_v4_%'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I CASCADE', r.typname);
    END LOOP;
END $$;

CREATE TYPE types.q_get_analytics_first_attempt_pass_view_v4_item AS (
    attempt_id uuid,
    profile_id uuid,
    simulation_id uuid,
    attempt_created_at timestamptz,
    grade_percent numeric,
    rubric_pass_points int,
    rubric_total_points int
);

CREATE OR REPLACE FUNCTION api_get_analytics_first_attempt_pass_view_v4(
    profile_id uuid DEFAULT NULL,
    cohort_ids uuid[] DEFAULT NULL,
    department_ids uuid[] DEFAULT NULL,
    attempt_type_filter text DEFAULT NULL,
    is_archived_filter boolean DEFAULT FALSE,
    date_from timestamptz DEFAULT NULL,
    date_to timestamptz DEFAULT NULL
)
RETURNS TABLE (
    items types.q_get_analytics_first_attempt_pass_view_v4_item[]
)
LANGUAGE sql
STABLE
AS $$
WITH params AS (
    SELECT
        profile_id AS profile_id,
        COALESCE(cohort_ids, ARRAY[]::uuid[]) AS cohort_ids,
        COALESCE(department_ids, ARRAY[]::uuid[]) AS department_ids,
        attempt_type_filter AS attempt_type_filter,
        COALESCE(is_archived_filter, FALSE) AS is_archived_filter,
        date_from AS date_from,
        date_to AS date_to
),
all_time_filtered AS (
    SELECT
        mv.attempt_id,
        mv.profile_id,
        mv.simulation_id,
        mv.attempt_created_at,
        mv.grade_percent,
        mv.rubric_pass_points,
        mv.rubric_total_points
    FROM mv_chat_facts mv
    CROSS JOIN params p
    WHERE
        (p.profile_id IS NULL OR mv.profile_id = p.profile_id)
        AND (cardinality(p.cohort_ids) = 0 OR mv.cohort_id = ANY(p.cohort_ids))
        AND (cardinality(p.department_ids) = 0 OR mv.department_id = ANY(p.department_ids))
        AND (p.attempt_type_filter IS NULL OR mv.attempt_type = p.attempt_type_filter)
        AND mv.is_archived = p.is_archived_filter
),
earliest AS (
    SELECT DISTINCT ON (a.profile_id, a.simulation_id)
        a.attempt_id,
        a.profile_id,
        a.simulation_id,
        a.attempt_created_at,
        a.grade_percent,
        a.rubric_pass_points,
        a.rubric_total_points
    FROM all_time_filtered a
    ORDER BY a.profile_id, a.simulation_id, a.attempt_created_at
),
windowed AS (
    SELECT e.*
    FROM earliest e
    CROSS JOIN params p
    WHERE
        (p.date_from IS NULL OR e.attempt_created_at >= p.date_from)
        AND (p.date_to IS NULL OR e.attempt_created_at < p.date_to)
)
SELECT COALESCE(
    ARRAY_AGG(
        (
            attempt_id,
            profile_id,
            simulation_id,
            attempt_created_at,
            grade_percent,
            rubric_pass_points,
            rubric_total_points
        )::types.q_get_analytics_first_attempt_pass_view_v4_item
        ORDER BY attempt_created_at
    ),
    ARRAY[]::types.q_get_analytics_first_attempt_pass_view_v4_item[]
) AS items
FROM windowed;
$$;
