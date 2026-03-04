-- Search problems entries from problems_mv

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) AS sig
        FROM pg_proc
        WHERE proname = 'api_search_problems_entries_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_search_problems_entries_v4(%s)', r.sig);
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.api_search_problems_entries_v4(
    search text DEFAULT NULL,
    limit_count integer DEFAULT 20,
    offset_count integer DEFAULT 0,
    session_id uuid DEFAULT NULL,
    profile_id uuid DEFAULT NULL
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
            'problem_id', m.problem_id,
            'profile_id', m.profile_id,
            'session_id', m.session_id,
            'type', m.type,
            'message', m.message,
            'resolved', m.resolved,
            'created_at', m.created_at,
            'active', m.active,
            'mcp', m.mcp,
            'generated', m.generated
        ) AS row_data
        FROM problems_mv m
        WHERE true
          AND (session_id IS NULL OR m.session_id = session_id)
          AND (profile_id IS NULL OR m.profile_id = profile_id)
        ORDER BY m.created_at DESC
        LIMIT limit_count
        OFFSET offset_count
    ) sub;
END;
$$;
