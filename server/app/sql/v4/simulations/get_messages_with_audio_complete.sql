-- Get messages with audio upload information for a chat
-- Converted to PostgreSQL function pattern
-- Uses safe drop/recreate pattern: drop function first, then recreate
-- 1) Drop function first
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'socket_get_messages_with_audio_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS socket_get_messages_with_audio_v4(%s)', r.sig);
    END LOOP;
END $$;

-- 2) Recreate function
CREATE OR REPLACE FUNCTION socket_get_messages_with_audio_v4(
    chat_id uuid,
    message_ids uuid[]
)
RETURNS TABLE (
    message_id text,
    upload_id text,
    file_path text,
    mime_type text,
    size bigint
)
LANGUAGE sql
STABLE
AS $$
    SELECT 
        m.id::text as message_id,
        au.upload_id::text as upload_id,
        u.file_path,
        u.mime_type,
        u.size
    FROM messages m
    JOIN message_audios ma ON ma.message_id = m.id
    JOIN audio_uploads au ON au.audio_id = ma.audio_id AND au.active = true
    JOIN uploads u ON u.id = au.upload_id
    JOIN message_runs mr ON mr.message_id = m.id
    JOIN runs r ON r.id = mr.run_id
    JOIN group_runs gr ON gr.run_id = r.id
    JOIN groups g ON g.id = gr.group_id
    JOIN chat_groups cg ON cg.group_id = g.id
    JOIN chats c ON c.id = cg.chat_id
    WHERE c.id = chat_id
      AND m.id = ANY(message_ids)
$$;