-- Resolve assistant message + chat context for an attempt run
SELECT
    m.id AS message_id,
    sm.chat_id,
    c.attempt_id,
    m.created_at
FROM messages_entry m
JOIN simulation_messages_entry sm ON sm.id = m.id
JOIN simulation_chats_entry c ON c.id = sm.chat_id
WHERE m.run_id = $1
  AND m.role = 'assistant'::message_type
ORDER BY m.created_at DESC
LIMIT 1;
