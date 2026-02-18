-- Search audios entries from audios_mv

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) AS sig
        FROM pg_proc
        WHERE proname = 'api_search_audios_entries_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_search_audios_entries_v4(%s)', r.sig);
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.api_search_audios_entries_v4(
    search text DEFAULT NULL,
    limit_count integer DEFAULT 20,
    offset_count integer DEFAULT 0,
    uploads_id uuid DEFAULT NULL,
    voice_id uuid DEFAULT NULL
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
            'audio_id', m.audio_id,
            'uploads_id', m.uploads_id,
            'file_path', m.file_path,
            'mime_type', m.mime_type,
            'size', m.size,
            'length_seconds', m.length_seconds,
            'voice_id', m.voice_id,
            'created_at', m.created_at
        ) AS row_data
        FROM audios_mv m
        WHERE true
          AND (uploads_id IS NULL OR m.uploads_id = uploads_id)
          AND (voice_id IS NULL OR m.voice_id = voice_id)
        ORDER BY m.created_at DESC
        LIMIT limit_count
        OFFSET offset_count
    ) sub;
END;
$$;
