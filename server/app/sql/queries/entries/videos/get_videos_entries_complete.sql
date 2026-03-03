-- Get videos entries by IDs from videos_mv

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) AS sig
        FROM pg_proc
        WHERE proname = 'api_get_videos_entries_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_videos_entries_v4(%s)', r.sig);
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.api_get_videos_entries_v4(
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
            'video_id', m.video_id,
            'uploads_id', m.uploads_id,
            'file_path', m.file_path,
            'mime_type', m.mime_type,
            'size', m.size,
            'length_seconds', m.length_seconds,
            'created_at', m.created_at
        )
    ) AS items
    FROM videos_mv m
    WHERE m.video_id = ANY(ids);
END;
$$;
