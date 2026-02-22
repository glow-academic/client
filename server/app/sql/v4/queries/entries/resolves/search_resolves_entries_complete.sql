-- Search resolves entries from resolves_mv

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) AS sig
        FROM pg_proc
        WHERE proname = 'api_search_resolves_entries_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_search_resolves_entries_v4(%s)', r.sig);
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.api_search_resolves_entries_v4(
    search text DEFAULT NULL,
    limit_count integer DEFAULT 20,
    offset_count integer DEFAULT 0,
    problem_id uuid DEFAULT NULL
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
            'id', m.id,
            'created_at', m.created_at,
            'generated', m.generated,
            'mcp', m.mcp,
            'active', m.active,
            'problem_id', m.problem_id,
            'resolved', m.resolved
        ) AS row_data
        FROM resolves_mv m
        WHERE true
          AND (problem_id IS NULL OR m.problem_id = problem_id)
        ORDER BY m.created_at DESC
        LIMIT limit_count
        OFFSET offset_count
    ) sub;
END;
$$;
