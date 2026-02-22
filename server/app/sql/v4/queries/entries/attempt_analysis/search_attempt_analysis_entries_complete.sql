-- Search attempt_analysis entries from attempt_analysis_mv

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) AS sig
        FROM pg_proc
        WHERE proname = 'api_search_attempt_analysis_entries_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_search_attempt_analysis_entries_v4(%s)', r.sig);
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.api_search_attempt_analysis_entries_v4(
    search text DEFAULT NULL,
    limit_count integer DEFAULT 20,
    offset_count integer DEFAULT 0,
    grade_id uuid DEFAULT NULL
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
            'analysis_id', m.analysis_id,
            'grade_id', m.grade_id,
            'content', m.content,
            'created_at', m.created_at
        ) AS row_data
        FROM attempt_analysis_mv m
        WHERE true
          AND (grade_id IS NULL OR m.grade_id = grade_id)
        ORDER BY m.created_at DESC
        LIMIT limit_count
        OFFSET offset_count
    ) sub;
END;
$$;
