-- Get attempt_grade entries by IDs from attempt_grade_mv

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) AS sig
        FROM pg_proc
        WHERE proname = 'api_get_attempt_grade_entries_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_attempt_grade_entries_v4(%s)', r.sig);
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.api_get_attempt_grade_entries_v4(
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
            'grade_id', m.grade_id,
            'chat_id', m.chat_id,
            'score', m.score,
            'passed', m.passed,
            'time_taken', m.time_taken,
            'total_points', m.total_points,
            'pass_points', m.pass_points,
            'rubric_id', m.rubric_id,
            'created_at', m.created_at
        )
    ) AS items
    FROM attempt_grade_mv m
    WHERE m.grade_id = ANY(ids);
END;
$$;
