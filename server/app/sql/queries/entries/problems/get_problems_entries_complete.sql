-- Get problems entries by IDs from problems_mv

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) AS sig
        FROM pg_proc
        WHERE proname = 'api_get_problems_entries_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_problems_entries_v4(%s)', r.sig);
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.api_get_problems_entries_v4(
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
        )
    ) AS items
    FROM problems_mv m
    WHERE m.problem_id = ANY(ids);
END;
$$;
