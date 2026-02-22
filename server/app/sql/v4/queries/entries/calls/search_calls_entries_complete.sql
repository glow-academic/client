-- Search calls entries from calls_mv

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) AS sig
        FROM pg_proc
        WHERE proname = 'api_search_calls_entries_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_search_calls_entries_v4(%s)', r.sig);
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.api_search_calls_entries_v4(
    search text DEFAULT NULL,
    limit_count integer DEFAULT 20,
    offset_count integer DEFAULT 0,
    run_id uuid DEFAULT NULL,
    tool_id uuid DEFAULT NULL
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
            'call_id', m.call_id,
            'run_id', m.run_id,
            'call_created_at', m.call_created_at,
            'arguments_raw', m.arguments_raw,
            'tool_id', m.tool_id
        ) AS row_data
        FROM calls_mv m
        WHERE true
          AND (run_id IS NULL OR m.run_id = run_id)
          AND (tool_id IS NULL OR m.tool_id = tool_id)
        ORDER BY m.call_created_at DESC
        LIMIT limit_count
        OFFSET offset_count
    ) sub;
END;
$$;
