-- Get invocation_resolved entries by IDs from invocation_resolved_mv

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) AS sig
        FROM pg_proc
        WHERE proname = 'api_get_invocation_resolved_entries_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_invocation_resolved_entries_v4(%s)', r.sig);
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.api_get_invocation_resolved_entries_v4(
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
            'invocation_id', m.invocation_id,
            'test_id', m.test_id,
            'group_id', m.group_id,
            'invocation_resolved_id', m.invocation_resolved_id,
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
        )
    ) AS items
    FROM invocation_resolved_mv m
    WHERE m.invocation_id = ANY(ids);
END;
$$;
