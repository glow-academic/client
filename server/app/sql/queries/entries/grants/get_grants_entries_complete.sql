-- Get grants entries by IDs from grants_mv

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) AS sig
        FROM pg_proc
        WHERE proname = 'api_get_grants_entries_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_grants_entries_v4(%s)', r.sig);
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.api_get_grants_entries_v4(
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
        )
    ) AS items
    FROM grants_mv m
    WHERE m.grant_id = ANY(ids);
END;
$$;
