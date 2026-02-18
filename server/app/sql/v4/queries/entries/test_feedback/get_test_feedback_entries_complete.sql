-- Get test_feedback entries by IDs from test_feedback_mv

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) AS sig
        FROM pg_proc
        WHERE proname = 'api_get_test_feedback_entries_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_test_feedback_entries_v4(%s)', r.sig);
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.api_get_test_feedback_entries_v4(
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
            'total', m.total,
            'feedback', m.feedback,
            'total_points', m.total_points,
            'pass_points', m.pass_points,
            'created_at', m.created_at
        )
    ) AS items
    FROM test_feedback_mv m
    WHERE m.feedback_id = ANY(ids);
END;
$$;
