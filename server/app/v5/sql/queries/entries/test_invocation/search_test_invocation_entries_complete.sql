-- Search test_invocation entries from test_invocation_mv

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) AS sig
        FROM pg_proc
        WHERE proname = 'api_search_test_invocation_entries_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_search_test_invocation_entries_v4(%s)', r.sig);
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.api_search_test_invocation_entries_v4(
    search text DEFAULT NULL,
    limit_count integer DEFAULT 20,
    offset_count integer DEFAULT 0,
    test_id uuid DEFAULT NULL,
    group_id uuid DEFAULT NULL,
    grade_id uuid DEFAULT NULL,
    rubric_id uuid DEFAULT NULL,
    model_id uuid DEFAULT NULL,
    prompt_id uuid DEFAULT NULL,
    voice_id uuid DEFAULT NULL,
    temperature_level_id uuid DEFAULT NULL,
    reasoning_level_id uuid DEFAULT NULL,
    key_id uuid DEFAULT NULL
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
            'invocation_id', m.invocation_id,
            'test_id', m.test_id,
            'group_id', m.group_id,
            'invocation_created_at', m.invocation_created_at,
            'invocation_title', m.invocation_title,
            'invocation_completed', m.invocation_completed,
            'grade_id', m.grade_id,
            'grade_score', m.grade_score,
            'grade_passed', m.grade_passed,
            'grade_time_taken', m.grade_time_taken,
            'rubric_id', m.rubric_id,
            'invocation_run_ids', m.invocation_run_ids,
            'run_ids', m.run_ids,
            'group_ids', m.group_ids,
            'instruction_ids', m.instruction_ids,
            'tool_ids', m.tool_ids,
            'model_id', m.model_id,
            'prompt_id', m.prompt_id,
            'voice_id', m.voice_id,
            'temperature_level_id', m.temperature_level_id,
            'reasoning_level_id', m.reasoning_level_id,
            'key_id', m.key_id,
            'historical_run_ids', m.historical_run_ids
        ) AS row_data
        FROM test_invocation_mv m
        WHERE true
          AND (test_id IS NULL OR m.test_id = test_id)
          AND (group_id IS NULL OR m.group_id = group_id)
          AND (grade_id IS NULL OR m.grade_id = grade_id)
          AND (rubric_id IS NULL OR m.rubric_id = rubric_id)
          AND (model_id IS NULL OR m.model_id = model_id)
          AND (prompt_id IS NULL OR m.prompt_id = prompt_id)
          AND (voice_id IS NULL OR m.voice_id = voice_id)
          AND (temperature_level_id IS NULL OR m.temperature_level_id = temperature_level_id)
          AND (reasoning_level_id IS NULL OR m.reasoning_level_id = reasoning_level_id)
          AND (key_id IS NULL OR m.key_id = key_id)
        ORDER BY m.invocation_created_at DESC
        LIMIT limit_count
        OFFSET offset_count
    ) sub;
END;
$$;
