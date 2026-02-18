-- Search debug_info entries from debug_info_mv

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) AS sig
        FROM pg_proc
        WHERE proname = 'api_search_debug_info_entries_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_search_debug_info_entries_v4(%s)', r.sig);
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.api_search_debug_info_entries_v4(
    search text DEFAULT NULL,
    limit_count integer DEFAULT 20,
    offset_count integer DEFAULT 0,
    call_id uuid DEFAULT NULL,
    run_id uuid DEFAULT NULL
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
            'created_at', m.created_at,
            'content', m.content,
            'id', m.id,
            'active', m.active,
            'generated', m.generated,
            'call_id', m.call_id,
            'mcp', m.mcp,
            'run_id', m.run_id
        ) AS row_data
        FROM debug_info_mv m
        WHERE true
          AND (call_id IS NULL OR m.call_id = call_id)
          AND (run_id IS NULL OR m.run_id = run_id)
        ORDER BY m.created_at DESC
        LIMIT limit_count
        OFFSET offset_count
    ) sub;
END;
$$;
