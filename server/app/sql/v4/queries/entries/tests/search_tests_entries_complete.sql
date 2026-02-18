-- Search tests entries from tests_mv

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) AS sig
        FROM pg_proc
        WHERE proname = 'api_search_tests_entries_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_search_tests_entries_v4(%s)', r.sig);
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.api_search_tests_entries_v4(
    search text DEFAULT NULL,
    limit_count integer DEFAULT 20,
    offset_count integer DEFAULT 0,
    attempt_id uuid DEFAULT NULL,
    group_id uuid DEFAULT NULL
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
        ) AS row_data
        FROM tests_mv m
        WHERE true
          AND (attempt_id IS NULL OR m.attempt_id = attempt_id)
          AND (group_id IS NULL OR m.group_id = group_id)
        ORDER BY m.created_at DESC
        LIMIT limit_count
        OFFSET offset_count
    ) sub;
END;
$$;
