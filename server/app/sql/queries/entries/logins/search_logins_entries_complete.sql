-- Search logins entries from logins_mv

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) AS sig
        FROM pg_proc
        WHERE proname = 'api_search_logins_entries_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_search_logins_entries_v4(%s)', r.sig);
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.api_search_logins_entries_v4(
    search text DEFAULT NULL,
    limit_count integer DEFAULT 20,
    offset_count integer DEFAULT 0,
    profile_id uuid DEFAULT NULL,
    session_id uuid DEFAULT NULL,
    call_id uuid DEFAULT NULL
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
            'login_id', m.login_id,
            'profile_id', m.profile_id,
            'session_id', m.session_id,
            'last_login', m.last_login,
            'login_created_at', m.login_created_at,
            'active', m.active,
            'generated', m.generated,
            'mcp', m.mcp,
            'call_id', m.call_id
        ) AS row_data
        FROM logins_mv m
        WHERE true
          AND (profile_id IS NULL OR m.profile_id = profile_id)
          AND (session_id IS NULL OR m.session_id = session_id)
          AND (call_id IS NULL OR m.call_id = call_id)
        ORDER BY m.login_created_at DESC
        LIMIT limit_count
        OFFSET offset_count
    ) sub;
END;
$$;
