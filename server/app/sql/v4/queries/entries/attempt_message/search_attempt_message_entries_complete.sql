-- Search attempt_message entries from attempt_message_mv

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) AS sig
        FROM pg_proc
        WHERE proname = 'api_search_attempt_message_entries_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_search_attempt_message_entries_v4(%s)', r.sig);
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.api_search_attempt_message_entries_v4(
    search text DEFAULT NULL,
    limit_count integer DEFAULT 20,
    offset_count integer DEFAULT 0,
    chat_id uuid DEFAULT NULL,
    attempt_id uuid DEFAULT NULL,
    runs_id uuid DEFAULT NULL,
    text_id uuid DEFAULT NULL,
    audio_id uuid DEFAULT NULL
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
        ) AS row_data
        FROM attempt_message_mv m
        WHERE true
          AND (chat_id IS NULL OR m.chat_id = chat_id)
          AND (attempt_id IS NULL OR m.attempt_id = attempt_id)
          AND (runs_id IS NULL OR m.runs_id = runs_id)
          AND (text_id IS NULL OR m.text_id = text_id)
          AND (audio_id IS NULL OR m.audio_id = audio_id)
        ORDER BY m.created_at DESC
        LIMIT limit_count
        OFFSET offset_count
    ) sub;
END;
$$;
