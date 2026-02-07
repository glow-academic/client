-- ============================================================================
-- Query Function: api_get_analytics_chat_facts_view_v4
-- Raw filtered access to mv_chat_facts (no resource JOINs).
-- ============================================================================

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) AS sig
        FROM pg_proc
        WHERE proname = 'api_get_analytics_chat_facts_view_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_analytics_chat_facts_view_v4(%s)', r.sig);
    END LOOP;
END $$;

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT typname
        FROM pg_type
        WHERE typname LIKE 'q_get_analytics_chat_facts_view_v4_%'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I CASCADE', r.typname);
    END LOOP;
END $$;

CREATE TYPE types.q_get_analytics_chat_facts_view_v4_item AS (
    chat_id uuid,
    attempt_id uuid,
    grade_id uuid,
    simulation_id uuid,
    profile_id uuid,
    cohort_id uuid,
    department_id uuid,
    role_id uuid,
    scenario_id uuid,
    persona_id uuid,
    rubric_id uuid,
    parameter_field_ids uuid[],
    parameter_ids uuid[],
    field_ids uuid[],
    persona_parameter_field_ids uuid[],
    persona_parameter_ids uuid[],
    persona_field_ids uuid[],
    document_parameter_field_ids uuid[],
    document_parameter_ids uuid[],
    document_field_ids uuid[],
    attempt_created_at timestamptz,
    chat_created_at timestamptz,
    grade_created_at timestamptz,
    attempt_type text,
    is_archived boolean,
    infinite_mode boolean,
    completed boolean,
    score int,
    passed boolean,
    time_taken int,
    grade_percent numeric,
    rubric_total_points int,
    rubric_pass_points int,
    num_messages_total int,
    message_time_taken_seconds int[]
);

CREATE OR REPLACE FUNCTION api_get_analytics_chat_facts_view_v4(
    profile_id uuid DEFAULT NULL,
    profile_ids uuid[] DEFAULT NULL,
    simulation_ids uuid[] DEFAULT NULL,
    cohort_ids uuid[] DEFAULT NULL,
    department_ids uuid[] DEFAULT NULL,
    scenario_ids uuid[] DEFAULT NULL,
    persona_ids uuid[] DEFAULT NULL,
    attempt_type_filter text DEFAULT NULL,
    is_archived_filter boolean DEFAULT FALSE,
    infinite_mode_filter boolean DEFAULT NULL,
    completed_filter boolean DEFAULT NULL,
    date_from timestamptz DEFAULT NULL,
    date_to timestamptz DEFAULT NULL,
    search text DEFAULT NULL,
    sort_by text DEFAULT 'date',
    sort_order text DEFAULT 'desc',
    page_limit int DEFAULT 50,
    page_offset int DEFAULT 0
)
RETURNS TABLE (
    total_count int,
    items types.q_get_analytics_chat_facts_view_v4_item[]
)
LANGUAGE sql
STABLE
AS $$
WITH params AS (
    SELECT
        profile_id AS profile_id,
        COALESCE(profile_ids, ARRAY[]::uuid[]) AS profile_ids,
        COALESCE(simulation_ids, ARRAY[]::uuid[]) AS simulation_ids,
        COALESCE(cohort_ids, ARRAY[]::uuid[]) AS cohort_ids,
        COALESCE(department_ids, ARRAY[]::uuid[]) AS department_ids,
        COALESCE(scenario_ids, ARRAY[]::uuid[]) AS scenario_ids,
        COALESCE(persona_ids, ARRAY[]::uuid[]) AS persona_ids,
        attempt_type_filter AS attempt_type_filter,
        COALESCE(is_archived_filter, FALSE) AS is_archived_filter,
        infinite_mode_filter AS infinite_mode_filter,
        completed_filter AS completed_filter,
        date_from AS date_from,
        date_to AS date_to,
        search AS search,
        COALESCE(sort_by, 'date') AS sort_by,
        COALESCE(sort_order, 'desc') AS sort_order,
        COALESCE(page_limit, 50) AS page_limit,
        COALESCE(page_offset, 0) AS page_offset
),
filtered AS (
    SELECT
        mv.chat_id,
        mv.attempt_id,
        mv.grade_id,
        mv.simulation_id,
        mv.profile_id,
        mv.cohort_id,
        mv.department_id,
        mv.role_id,
        mv.scenario_id,
        mv.persona_id,
        mv.rubric_id,
        mv.parameter_field_ids,
        mv.parameter_ids,
        mv.field_ids,
        mv.persona_parameter_field_ids,
        mv.persona_parameter_ids,
        mv.persona_field_ids,
        mv.document_parameter_field_ids,
        mv.document_parameter_ids,
        mv.document_field_ids,
        mv.attempt_created_at,
        mv.chat_created_at,
        mv.grade_created_at,
        mv.attempt_type,
        mv.is_archived,
        mv.infinite_mode,
        mv.completed,
        mv.score,
        mv.passed,
        mv.time_taken,
        mv.grade_percent,
        mv.rubric_total_points,
        mv.rubric_pass_points,
        mv.num_messages_total,
        mv.message_time_taken_seconds
    FROM mv_chat_facts mv
    CROSS JOIN params p
    WHERE
        (
            (p.profile_id IS NOT NULL AND mv.profile_id = p.profile_id)
            OR (p.profile_id IS NULL AND (cardinality(p.profile_ids) = 0 OR mv.profile_id = ANY(p.profile_ids)))
        )
        AND (cardinality(p.simulation_ids) = 0 OR mv.simulation_id = ANY(p.simulation_ids))
        AND (cardinality(p.cohort_ids) = 0 OR mv.cohort_id = ANY(p.cohort_ids))
        AND (cardinality(p.department_ids) = 0 OR mv.department_id = ANY(p.department_ids))
        AND (cardinality(p.scenario_ids) = 0 OR mv.scenario_id = ANY(p.scenario_ids))
        AND (cardinality(p.persona_ids) = 0 OR mv.persona_id = ANY(p.persona_ids))
        AND (p.attempt_type_filter IS NULL OR mv.attempt_type = p.attempt_type_filter)
        AND mv.is_archived = p.is_archived_filter
        AND (p.infinite_mode_filter IS NULL OR mv.infinite_mode = p.infinite_mode_filter)
        AND (p.completed_filter IS NULL OR mv.completed = p.completed_filter)
        AND (p.date_from IS NULL OR mv.chat_created_at >= p.date_from)
        AND (p.date_to IS NULL OR mv.chat_created_at < p.date_to)
        AND (
            p.search IS NULL
            OR mv.chat_id::text ILIKE '%' || p.search || '%'
            OR mv.attempt_id::text ILIKE '%' || p.search || '%'
        )
),
counted AS (
    SELECT COUNT(*)::int AS total_count FROM filtered
),
sorted AS (
    SELECT f.*
    FROM filtered f
    CROSS JOIN params p
    ORDER BY
        CASE WHEN p.sort_by = 'date' AND p.sort_order = 'desc' THEN f.chat_created_at END DESC NULLS LAST,
        CASE WHEN p.sort_by = 'date' AND p.sort_order = 'asc' THEN f.chat_created_at END ASC NULLS LAST,
        CASE WHEN p.sort_by = 'score' AND p.sort_order = 'desc' THEN f.grade_percent END DESC NULLS LAST,
        CASE WHEN p.sort_by = 'score' AND p.sort_order = 'asc' THEN f.grade_percent END ASC NULLS LAST,
        f.chat_created_at DESC NULLS LAST
    LIMIT (SELECT page_limit FROM params)
    OFFSET (SELECT page_offset FROM params)
),
items_agg AS (
    SELECT COALESCE(
        ARRAY_AGG(
            (
                chat_id,
                attempt_id,
                grade_id,
                simulation_id,
                profile_id,
                cohort_id,
                department_id,
                role_id,
                scenario_id,
                persona_id,
                rubric_id,
                parameter_field_ids,
                parameter_ids,
                field_ids,
                persona_parameter_field_ids,
                persona_parameter_ids,
                persona_field_ids,
                document_parameter_field_ids,
                document_parameter_ids,
                document_field_ids,
                attempt_created_at,
                chat_created_at,
                grade_created_at,
                attempt_type,
                is_archived,
                infinite_mode,
                completed,
                score,
                passed,
                time_taken,
                grade_percent,
                rubric_total_points,
                rubric_pass_points,
                num_messages_total,
                message_time_taken_seconds
            )::types.q_get_analytics_chat_facts_view_v4_item
        ),
        ARRAY[]::types.q_get_analytics_chat_facts_view_v4_item[]
    ) AS items
    FROM sorted
)
SELECT
    (SELECT total_count FROM counted),
    (SELECT items FROM items_agg);
$$;
