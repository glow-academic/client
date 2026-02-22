-- Search sessions entries from sessions_mv

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) AS sig
        FROM pg_proc
        WHERE proname = 'api_search_sessions_entries_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_search_sessions_entries_v4(%s)', r.sig);
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.api_search_sessions_entries_v4(
    search text DEFAULT NULL,
    limit_count integer DEFAULT 20,
    offset_count integer DEFAULT 0,
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
            'session_id', m.session_id,
            'profile_id', m.profile_id,
            'session_created_at', m.session_created_at,
            'active', m.active
        ) AS row_data
        FROM sessions_mv m
        WHERE true
          AND (profile_id IS NULL OR m.profile_id = profile_id)
        ORDER BY m.session_created_at DESC
        LIMIT limit_count
        OFFSET offset_count
    ) sub;
END;
$$;
