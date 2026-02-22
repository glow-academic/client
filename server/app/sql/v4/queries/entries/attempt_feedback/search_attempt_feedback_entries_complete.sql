-- Search attempt_feedback entries from attempt_feedback_mv

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) AS sig
        FROM pg_proc
        WHERE proname = 'api_search_attempt_feedback_entries_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_search_attempt_feedback_entries_v4(%s)', r.sig);
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.api_search_attempt_feedback_entries_v4(
    search text DEFAULT NULL,
    limit_count integer DEFAULT 20,
    offset_count integer DEFAULT 0,
    grade_id uuid DEFAULT NULL,
    standard_id uuid DEFAULT NULL
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
            'feedback_id', m.feedback_id,
            'grade_id', m.grade_id,
            'standard_id', m.standard_id,
            'total', m.total,
            'feedback', m.feedback,
            'created_at', m.created_at
        ) AS row_data
        FROM attempt_feedback_mv m
        WHERE true
          AND (grade_id IS NULL OR m.grade_id = grade_id)
          AND (standard_id IS NULL OR m.standard_id = standard_id)
        ORDER BY m.created_at DESC
        LIMIT limit_count
        OFFSET offset_count
    ) sub;
END;
$$;
