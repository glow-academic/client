-- Get attempt_message entries by IDs from attempt_message_mv

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) AS sig
        FROM pg_proc
        WHERE proname = 'api_get_attempt_message_entries_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_attempt_message_entries_v4(%s)', r.sig);
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.api_get_attempt_message_entries_v4(
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
            'chat_id', m.chat_id,
            'attempt_id', m.attempt_id,
            'type', m.type,
            'created_at', m.created_at,
            'completed', m.completed,
            'runs_id', m.runs_id,
            'text_id', m.text_id,
            'history_content', m.history_content,
            'audio_id', m.audio_id
        )
    ) AS items
    FROM attempt_message_mv m
    WHERE m.message_id = ANY(ids);
END;
$$;
