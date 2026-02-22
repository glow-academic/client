-- Search test_grade entries from test_grade_mv

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) AS sig
        FROM pg_proc
        WHERE proname = 'api_search_test_grade_entries_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_search_test_grade_entries_v4(%s)', r.sig);
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.api_search_test_grade_entries_v4(
    search text DEFAULT NULL,
    limit_count integer DEFAULT 20,
    offset_count integer DEFAULT 0,
    invocation_id uuid DEFAULT NULL,
    run_id uuid DEFAULT NULL,
    rubric_grade_agent_id uuid DEFAULT NULL
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
        ) AS row_data
        FROM test_grade_mv m
        WHERE true
          AND (invocation_id IS NULL OR m.invocation_id = invocation_id)
          AND (run_id IS NULL OR m.run_id = run_id)
          AND (rubric_grade_agent_id IS NULL OR m.rubric_grade_agent_id = rubric_grade_agent_id)
        ORDER BY m.created_at DESC
        LIMIT limit_count
        OFFSET offset_count
    ) sub;
END;
$$;
