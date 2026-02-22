-- Search attempt_grade entries from attempt_grade_mv

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) AS sig
        FROM pg_proc
        WHERE proname = 'api_search_attempt_grade_entries_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_search_attempt_grade_entries_v4(%s)', r.sig);
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.api_search_attempt_grade_entries_v4(
    search text DEFAULT NULL,
    limit_count integer DEFAULT 20,
    offset_count integer DEFAULT 0,
    chat_id uuid DEFAULT NULL,
    rubric_id uuid DEFAULT NULL
) RETURNS TABLE(
    items jsonb
)
LANGUAGE plpgsql STABLE
AS $$
#variable_conflict use_variable
BEGIN
    RETURN QUERY
    SELECT jsonb_agg(row_data) AS items
    FROM (
        SELECT jsonb_build_object(
            'grade_id', m.grade_id,
            'chat_id', m.chat_id,
            'score', m.score,
            'passed', m.passed,
            'time_taken', m.time_taken,
            'total_points', m.total_points,
            'pass_points', m.pass_points,
            'rubric_id', m.rubric_id,
            'created_at', m.created_at
        ) AS row_data
        FROM attempt_grade_mv m
        WHERE true
          AND (chat_id IS NULL OR m.chat_id = chat_id)
          AND (rubric_id IS NULL OR m.rubric_id = rubric_id)
        ORDER BY m.created_at DESC
        LIMIT limit_count
        OFFSET offset_count
    ) sub;
END;
$$;
