-- Get config entries by IDs from config_mv

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) AS sig
        FROM pg_proc
        WHERE proname = 'api_get_config_entries_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_config_entries_v4(%s)', r.sig);
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.api_get_config_entries_v4(
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
            'config_id', m.config_id,
            'agents_id', m.agents_id,
            'models_id', m.models_id,
            'providers_id', m.providers_id,
            'tool_ids', m.tool_ids,
            'config_created_at', m.config_created_at
        )
    ) AS items
    FROM config_mv m
    WHERE m.config_id = ANY(ids);
END;
$$;
