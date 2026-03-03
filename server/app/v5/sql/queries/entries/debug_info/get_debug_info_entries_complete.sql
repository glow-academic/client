-- Get debug_info entries by IDs from debug_info_mv

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) AS sig
        FROM pg_proc
        WHERE proname = 'api_get_debug_info_entries_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_debug_info_entries_v4(%s)', r.sig);
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.api_get_debug_info_entries_v4(
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
            'created_at', m.created_at,
            'content', m.content,
            'id', m.id,
            'active', m.active,
            'generated', m.generated,
            'call_id', m.call_id,
            'mcp', m.mcp,
            'run_id', m.run_id
        )
    ) AS items
    FROM debug_info_mv m
    WHERE m.id = ANY(ids);
END;
$$;
