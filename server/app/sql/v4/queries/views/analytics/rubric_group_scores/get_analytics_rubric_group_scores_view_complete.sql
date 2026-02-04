-- ============================================================================
-- Query Function: api_get_analytics_rubric_group_scores_view_v4
-- Returns per-chat standard-group score rows for given chat IDs.
-- ============================================================================

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) AS sig
        FROM pg_proc
        WHERE proname = 'api_get_analytics_rubric_group_scores_view_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_analytics_rubric_group_scores_view_v4(%s)', r.sig);
    END LOOP;
END $$;

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT typname
        FROM pg_type
        WHERE typname LIKE 'q_get_analytics_rubric_group_scores_view_v4_%'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I CASCADE', r.typname);
    END LOOP;
END $$;

CREATE TYPE types.q_get_analytics_rubric_group_scores_view_v4_item AS (
    chat_id uuid,
    rubric_id uuid,
    standard_group_id uuid,
    group_name text,
    group_short_name text,
    score_percent float8
);

CREATE OR REPLACE FUNCTION api_get_analytics_rubric_group_scores_view_v4(
    chat_ids uuid[] DEFAULT NULL
)
RETURNS TABLE (
    items types.q_get_analytics_rubric_group_scores_view_v4_item[]
)
LANGUAGE sql
STABLE
AS $$
SELECT COALESCE(
    ARRAY_AGG(
        (
            v.chat_id,
            v.rubric_id,
            v.standard_group_id,
            v.group_name,
            v.group_short_name,
            v.score_percent
        )::types.q_get_analytics_rubric_group_scores_view_v4_item
    ),
    ARRAY[]::types.q_get_analytics_rubric_group_scores_view_v4_item[]
) AS items
FROM view_grade_per_standard_group v
WHERE
    COALESCE(cardinality(chat_ids), 0) = 0
    OR v.chat_id = ANY(chat_ids);
$$;

