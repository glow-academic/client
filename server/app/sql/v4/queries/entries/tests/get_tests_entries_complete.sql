-- Get tests entries by IDs from tests_mv

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) AS sig
        FROM pg_proc
        WHERE proname = 'api_get_tests_entries_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_tests_entries_v4(%s)', r.sig);
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.api_get_tests_entries_v4(
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
            'updated_at', m.updated_at,
            'title', m.title,
            'completed', m.completed,
            'trace_id', m.trace_id,
            'id', m.id,
            'generated', m.generated,
            'mcp', m.mcp,
            'active', m.active,
            'attempt_id', m.attempt_id,
            'group_id', m.group_id
        )
    ) AS items
    FROM tests_mv m
    WHERE m.id = ANY(ids);
END;
$$;
