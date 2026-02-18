-- Get audits entries by IDs from audits_mv

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) AS sig
        FROM pg_proc
        WHERE proname = 'api_get_audits_entries_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_audits_entries_v4(%s)', r.sig);
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.api_get_audits_entries_v4(
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
            'audit_id', m.audit_id,
            'session_id', m.session_id,
            'audit_created_at', m.audit_created_at,
            'message', m.message,
            'endpoint', m.endpoint,
            'error', m.error
        )
    ) AS items
    FROM audits_mv m
    WHERE m.audit_id = ANY(ids);
END;
$$;
