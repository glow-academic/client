-- Get test_completion entries by IDs from test_completion_mv

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) AS sig
        FROM pg_proc
        WHERE proname = 'api_get_test_completion_entries_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_test_completion_entries_v4(%s)', r.sig);
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.api_get_test_completion_entries_v4(
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
            'id', m.id,
            'created_at', m.created_at,
            'generated', m.generated,
            'mcp', m.mcp,
            'active', m.active,
            'invocation_id', m.invocation_id,
            'end_reason', m.end_reason
        )
    ) AS items
    FROM test_completion_mv m
    WHERE m.id = ANY(ids);
END;
$$;
