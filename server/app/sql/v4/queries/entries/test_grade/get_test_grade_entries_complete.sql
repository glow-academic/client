-- Get test_grade entries by IDs from test_grade_mv

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) AS sig
        FROM pg_proc
        WHERE proname = 'api_get_test_grade_entries_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_test_grade_entries_v4(%s)', r.sig);
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.api_get_test_grade_entries_v4(
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
            'id', m.id,
            'invocation_id', m.invocation_id,
            'run_id', m.run_id,
            'rubric_grade_agent_id', m.rubric_grade_agent_id,
            'created_at', m.created_at,
            'updated_at', m.updated_at,
            'passed', m.passed,
            'score', m.score,
            'time_taken', m.time_taken,
            'generated', m.generated,
            'mcp', m.mcp,
            'active', m.active,
            'total_points', m.total_points,
            'pass_points', m.pass_points
        )
    ) AS items
    FROM test_grade_mv m
    WHERE m.id = ANY(ids);
END;
$$;
