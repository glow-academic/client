-- Search invocation entries from invocation_mv

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) AS sig
        FROM pg_proc
        WHERE proname = 'api_search_invocation_entries_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_search_invocation_entries_v4(%s)', r.sig);
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.api_search_invocation_entries_v4(
    search text DEFAULT NULL,
    limit_count integer DEFAULT 20,
    offset_count integer DEFAULT 0,
    benchmark_id uuid DEFAULT NULL
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
            'invocation_entry_id', m.invocation_entry_id,
            'benchmark_id', m.benchmark_id,
            'department_ids', m.department_ids,
            'model_ids', m.model_ids,
            'prompt_ids', m.prompt_ids,
            'instruction_ids', m.instruction_ids,
            'voice_ids', m.voice_ids,
            'temperature_level_ids', m.temperature_level_ids,
            'reasoning_level_ids', m.reasoning_level_ids,
            'tool_ids', m.tool_ids,
            'key_ids', m.key_ids,
            'flag_ids', m.flag_ids,
            'name_ids', m.name_ids,
            'description_ids', m.description_ids,
            'created_at', m.created_at,
            'updated_at', m.updated_at,
            'active', m.active
        ) AS row_data
        FROM invocation_mv m
        WHERE true
          AND (benchmark_id IS NULL OR m.benchmark_id = benchmark_id)
        ORDER BY m.created_at DESC
        LIMIT limit_count
        OFFSET offset_count
    ) sub;
END;
$$;
