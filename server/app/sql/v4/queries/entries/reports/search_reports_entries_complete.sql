-- Search reports entries from reports_mv

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) AS sig
        FROM pg_proc
        WHERE proname = 'api_search_reports_entries_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_search_reports_entries_v4(%s)', r.sig);
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.api_search_reports_entries_v4(
    search text DEFAULT NULL,
    limit_count integer DEFAULT 20,
    offset_count integer DEFAULT 0,
    upload_id uuid DEFAULT NULL
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
            'upload_id', m.upload_id
        ) AS row_data
        FROM reports_mv m
        WHERE true
          AND (upload_id IS NULL OR m.upload_id = upload_id)
        ORDER BY m.created_at DESC
        LIMIT limit_count
        OFFSET offset_count
    ) sub;
END;
$$;
