-- Search audits entries from audits_mv

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) AS sig
        FROM pg_proc
        WHERE proname = 'api_search_audits_entries_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_search_audits_entries_v4(%s)', r.sig);
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.api_search_audits_entries_v4(
    search text DEFAULT NULL,
    limit_count integer DEFAULT 20,
    offset_count integer DEFAULT 0,
    session_id uuid DEFAULT NULL
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
            'audit_id', m.audit_id,
            'session_id', m.session_id,
            'audit_created_at', m.audit_created_at,
            'message', m.message,
            'endpoint', m.endpoint,
            'error', m.error
        ) AS row_data
        FROM audits_mv m
        WHERE true
          AND (session_id IS NULL OR m.session_id = session_id)
        ORDER BY m.audit_created_at DESC
        LIMIT limit_count
        OFFSET offset_count
    ) sub;
END;
$$;
