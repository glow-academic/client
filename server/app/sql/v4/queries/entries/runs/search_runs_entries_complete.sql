-- Search runs entries from runs_mv

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) AS sig
        FROM pg_proc
        WHERE proname = 'api_search_runs_entries_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_search_runs_entries_v4(%s)', r.sig);
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.api_search_runs_entries_v4(
    search text DEFAULT NULL,
    limit_count integer DEFAULT 20,
    offset_count integer DEFAULT 0,
    group_id uuid DEFAULT NULL,
    input_pricing_unit_id uuid DEFAULT NULL,
    input_pricing_pricing_id uuid DEFAULT NULL,
    output_pricing_unit_id uuid DEFAULT NULL,
    output_pricing_pricing_id uuid DEFAULT NULL,
    cached_pricing_unit_id uuid DEFAULT NULL,
    cached_pricing_pricing_id uuid DEFAULT NULL
) RETURNS TABLE(
    items jsonb
)
LANGUAGE plpgsql STABLE
AS $$
BEGIN
    RETURN QUERY
    SELECT jsonb_agg(row_data) AS items
    FROM (
        SELECT jsonb_build_object(
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
            'input_pricing_unit_id', m.input_pricing_unit_id,
            'input_pricing_pricing_id', m.input_pricing_pricing_id,
            'output_pricing_count', m.output_pricing_count,
            'output_pricing_unit_id', m.output_pricing_unit_id,
            'output_pricing_pricing_id', m.output_pricing_pricing_id,
            'cached_pricing_count', m.cached_pricing_count,
            'cached_pricing_unit_id', m.cached_pricing_unit_id,
            'cached_pricing_pricing_id', m.cached_pricing_pricing_id,
            'debug_info', m.debug_info
        ) AS row_data
        FROM runs_mv m
        WHERE true
          AND (group_id IS NULL OR m.group_id = group_id)
          AND (input_pricing_unit_id IS NULL OR m.input_pricing_unit_id = input_pricing_unit_id)
          AND (input_pricing_pricing_id IS NULL OR m.input_pricing_pricing_id = input_pricing_pricing_id)
          AND (output_pricing_unit_id IS NULL OR m.output_pricing_unit_id = output_pricing_unit_id)
          AND (output_pricing_pricing_id IS NULL OR m.output_pricing_pricing_id = output_pricing_pricing_id)
          AND (cached_pricing_unit_id IS NULL OR m.cached_pricing_unit_id = cached_pricing_unit_id)
          AND (cached_pricing_pricing_id IS NULL OR m.cached_pricing_pricing_id = cached_pricing_pricing_id)
        ORDER BY m.run_created_at DESC
        LIMIT limit_count
        OFFSET offset_count
    ) sub;
END;
$$;
