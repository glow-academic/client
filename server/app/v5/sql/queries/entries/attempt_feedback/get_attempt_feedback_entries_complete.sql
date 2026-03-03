-- Get attempt_feedback entries by IDs from attempt_feedback_mv

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) AS sig
        FROM pg_proc
        WHERE proname = 'api_get_attempt_feedback_entries_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_attempt_feedback_entries_v4(%s)', r.sig);
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.api_get_attempt_feedback_entries_v4(
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
            'feedback_id', m.feedback_id,
            'grade_id', m.grade_id,
            'standard_id', m.standard_id,
            'total', m.total,
            'feedback', m.feedback,
            'created_at', m.created_at
        )
    ) AS items
    FROM attempt_feedback_mv m
    WHERE m.feedback_id = ANY(ids);
END;
$$;
