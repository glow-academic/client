-- Get messages entries by IDs from messages_mv

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) AS sig
        FROM pg_proc
        WHERE proname = 'api_get_messages_entries_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_messages_entries_v4(%s)', r.sig);
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.api_get_messages_entries_v4(
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
            'message_id', m.message_id,
            'run_id', m.run_id,
            'role', m.role,
            'message_created_at', m.message_created_at,
            'text_upload_ids', m.text_upload_ids,
            'audio_upload_ids', m.audio_upload_ids,
            'image_upload_ids', m.image_upload_ids,
            'video_upload_ids', m.video_upload_ids,
            'file_upload_ids', m.file_upload_ids,
            'call_upload_ids', m.call_upload_ids
        )
    ) AS items
    FROM messages_mv m
    WHERE m.message_id = ANY(ids);
END;
$$;
