-- Get uploads entries by IDs from uploads_mv

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) AS sig
        FROM pg_proc
        WHERE proname = 'api_get_uploads_entries_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_uploads_entries_v4(%s)', r.sig);
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.api_get_uploads_entries_v4(
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
            'files_id', m.files_id,
            'upload_id', m.upload_id,
            'file_path', m.file_path,
            'mime_type', m.mime_type,
            'size', m.size,
            'created_at', m.created_at
        )
    ) AS items
    FROM uploads_mv m
    WHERE m.files_id = ANY(ids);
END;
$$;
