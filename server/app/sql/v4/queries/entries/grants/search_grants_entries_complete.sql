-- Search grants entries from grants_mv

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) AS sig
        FROM pg_proc
        WHERE proname = 'api_search_grants_entries_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_search_grants_entries_v4(%s)', r.sig);
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.api_search_grants_entries_v4(
    search text DEFAULT NULL,
    limit_count integer DEFAULT 20,
    offset_count integer DEFAULT 0,
    grantor_id uuid DEFAULT NULL,
    emulation_id uuid DEFAULT NULL,
    emulated_id uuid DEFAULT NULL,
    grant_session_id uuid DEFAULT NULL,
    emulation_session_id uuid DEFAULT NULL
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
            'grant_id', m.grant_id,
            'grantor_id', m.grantor_id,
            'emulation_id', m.emulation_id,
            'emulated_id', m.emulated_id,
            'grant_session_id', m.grant_session_id,
            'emulation_session_id', m.emulation_session_id,
            'expires_at', m.expires_at,
            'used_at', m.used_at,
            'revoked_at', m.revoked_at,
            'created_at', m.created_at
        ) AS row_data
        FROM grants_mv m
        WHERE true
          AND (grantor_id IS NULL OR m.grantor_id = grantor_id)
          AND (emulation_id IS NULL OR m.emulation_id = emulation_id)
          AND (emulated_id IS NULL OR m.emulated_id = emulated_id)
          AND (grant_session_id IS NULL OR m.grant_session_id = grant_session_id)
          AND (emulation_session_id IS NULL OR m.emulation_session_id = emulation_session_id)
        ORDER BY m.created_at DESC
        LIMIT limit_count
        OFFSET offset_count
    ) sub;
END;
$$;
