-- Create or reuse assistant message for a run
-- Uses safe drop/recreate pattern: drop function first, then recreate
-- Note: Inserts into general_messages_entry by default. If you need practice messages,
-- the chat_id must be determined from context and routed appropriately.
DROP FUNCTION IF EXISTS socket_create_assistant_message_for_run_v4(uuid, uuid);

CREATE OR REPLACE FUNCTION socket_create_assistant_message_for_run_v4(
    run_id uuid,
    chat_id uuid DEFAULT NULL
)
RETURNS TABLE (
    assistant_message_id uuid
)
LANGUAGE sql
VOLATILE
AS $$
WITH params AS (
    SELECT socket_create_assistant_message_for_run_v4.run_id AS run_id,
           socket_create_assistant_message_for_run_v4.chat_id AS chat_id
),
-- Determine chat type from chat_id if provided
chat_type AS (
    SELECT
        CASE
            WHEN EXISTS (SELECT 1 FROM general_chats_entry WHERE id = (SELECT chat_id FROM params)) THEN 'general'
            WHEN EXISTS (SELECT 1 FROM practice_chats_entry WHERE id = (SELECT chat_id FROM params)) THEN 'practice'
            ELSE 'general'  -- Default to general if no chat_id or not found
        END AS type
),
existing_assistant_message AS (
    SELECT m.id as assistant_message_id
    FROM params p
    JOIN messages_entry m ON m.run_id = p.run_id
    WHERE m.role = 'assistant'::message_type
    ORDER BY m.created_at DESC
    LIMIT 1
),
-- Insert into general_messages_entry if chat type is general or default
new_general_assistant_message AS (
    INSERT INTO general_messages_entry (chat_id, role, completed, audio, run_id, created_at, updated_at)
    SELECT p.chat_id, 'assistant'::message_type, false, false, p.run_id, NOW(), NOW()
    FROM params p, chat_type ct
    WHERE NOT EXISTS (SELECT 1 FROM existing_assistant_message)
      AND ct.type = 'general'
      AND p.chat_id IS NOT NULL
    RETURNING id as assistant_message_id
),
-- Insert into practice_messages_entry if chat type is practice
new_practice_assistant_message AS (
    INSERT INTO practice_messages_entry (chat_id, role, completed, audio, run_id, created_at, updated_at)
    SELECT p.chat_id, 'assistant'::message_type, false, false, p.run_id, NOW(), NOW()
    FROM params p, chat_type ct
    WHERE NOT EXISTS (SELECT 1 FROM existing_assistant_message)
      AND ct.type = 'practice'
      AND p.chat_id IS NOT NULL
    RETURNING id as assistant_message_id
)
SELECT COALESCE(
    (SELECT assistant_message_id FROM existing_assistant_message),
    (SELECT assistant_message_id FROM new_general_assistant_message),
    (SELECT assistant_message_id FROM new_practice_assistant_message)
) as assistant_message_id
$$;
