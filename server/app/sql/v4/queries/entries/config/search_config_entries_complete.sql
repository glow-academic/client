-- Search config entries from config_mv

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) AS sig
        FROM pg_proc
        WHERE proname = 'api_search_config_entries_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_search_config_entries_v4(%s)', r.sig);
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.api_search_config_entries_v4(
    search text DEFAULT NULL,
    limit_count integer DEFAULT 20,
    offset_count integer DEFAULT 0,
    agents_id uuid DEFAULT NULL,
    models_id uuid DEFAULT NULL,
    providers_id uuid DEFAULT NULL
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
            'config_id', m.config_id,
            'agents_id', m.agents_id,
            'models_id', m.models_id,
            'providers_id', m.providers_id,
            'tool_ids', m.tool_ids,
            'config_created_at', m.config_created_at
        ) AS row_data
        FROM config_mv m
        WHERE true
          AND (agents_id IS NULL OR m.agents_id = agents_id)
          AND (models_id IS NULL OR m.models_id = models_id)
          AND (providers_id IS NULL OR m.providers_id = providers_id)
        ORDER BY m.config_created_at DESC
        LIMIT limit_count
        OFFSET offset_count
    ) sub;
END;
$$;
