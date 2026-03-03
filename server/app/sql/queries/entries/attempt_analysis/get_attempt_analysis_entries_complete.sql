-- Get attempt_analysis entries by IDs from attempt_analysis_mv

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) AS sig
        FROM pg_proc
        WHERE proname = 'api_get_attempt_analysis_entries_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_attempt_analysis_entries_v4(%s)', r.sig);
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.api_get_attempt_analysis_entries_v4(
    ids uuid[]
) RETURNS TABLE(
    items jsonb
)
LANGUAGE plpgsql STABLE
AS $$
BEGIN
    RETURN QUERY
    SELECT jsonb_agg(
        jsonb_build_object(
            'analysis_id', m.analysis_id,
            'grade_id', m.grade_id,
            'content', m.content,
            'created_at', m.created_at
        )
    ) AS items
    FROM attempt_analysis_mv m
    WHERE m.analysis_id = ANY(ids);
END;
$$;
