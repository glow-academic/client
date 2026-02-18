-- Get suite entries by IDs from suite_mv

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) AS sig
        FROM pg_proc
        WHERE proname = 'api_get_suite_entries_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_suite_entries_v4(%s)', r.sig);
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.api_get_suite_entries_v4(
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
            'suite_entry_id', m.suite_entry_id,
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
        )
    ) AS items
    FROM suite_mv m
    WHERE m.suite_entry_id = ANY(ids);
END;
$$;
