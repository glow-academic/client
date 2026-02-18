-- Get calls entries by IDs from calls_mv

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) AS sig
        FROM pg_proc
        WHERE proname = 'api_get_calls_entries_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_calls_entries_v4(%s)', r.sig);
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.api_get_calls_entries_v4(
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
            'call_id', m.call_id,
            'run_id', m.run_id,
            'call_created_at', m.call_created_at,
            'arguments_raw', m.arguments_raw,
            'tool_id', m.tool_id
        )
    ) AS items
    FROM calls_mv m
    WHERE m.call_id = ANY(ids);
END;
$$;
