-- Create or reuse assistant message for a run
-- After migration 364: Insert into messages_entry first, then attempt_message_entry
-- Uses safe drop/recreate pattern: drop function first, then recreate
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
existing_assistant_message AS (
    SELECT m.id as assistant_message_id
    FROM params p
    JOIN messages_entry m ON m.run_id = p.run_id
    WHERE m.role = 'assistant'::message_type
    ORDER BY m.created_at DESC
    LIMIT 1
),
-- Create new message in base table
new_message_base AS (
    INSERT INTO messages_entry (run_id, role, created_at)
    SELECT p.run_id, 'assistant'::message_type, NOW()
    FROM params p
    WHERE NOT EXISTS (SELECT 1 FROM existing_assistant_message)
      AND p.chat_id IS NOT NULL
    RETURNING id as assistant_message_id
),
-- Link to simulation chat
new_message_sim AS (
    INSERT INTO attempt_message_entry (id, chat_id)
    SELECT nmb.assistant_message_id, p.chat_id
    FROM new_message_base nmb
    CROSS JOIN params p
    WHERE p.chat_id IS NOT NULL
    RETURNING id as assistant_message_id
)
SELECT COALESCE(
    (SELECT assistant_message_id FROM existing_assistant_message),
    (SELECT assistant_message_id FROM new_message_sim)
) as assistant_message_id
$$;
