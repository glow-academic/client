-- Get runs entries by IDs from runs_mv

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) AS sig
        FROM pg_proc
        WHERE proname = 'api_get_runs_entries_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_runs_entries_v4(%s)', r.sig);
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.api_get_runs_entries_v4(
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
            'run_id', m.run_id,
            'group_id', m.group_id,
            'input_tokens', m.input_tokens,
            'output_tokens', m.output_tokens,
            'cached_input_tokens', m.cached_input_tokens,
            'run_created_at', m.run_created_at,
            'agent_ids', m.agent_ids,
            'model_ids', m.model_ids,
            'provider_ids', m.provider_ids,
            'input_pricing_count', m.input_pricing_count,
            'input_pricing_pricing_id', m.input_pricing_pricing_id,
            'output_pricing_count', m.output_pricing_count,
            'output_pricing_pricing_id', m.output_pricing_pricing_id,
            'cached_pricing_count', m.cached_pricing_count,
            'cached_pricing_pricing_id', m.cached_pricing_pricing_id,
            'debug_info', m.debug_info
        )
    ) AS items
    FROM runs_mv m
    WHERE m.run_id = ANY(ids);
END;
$$;
