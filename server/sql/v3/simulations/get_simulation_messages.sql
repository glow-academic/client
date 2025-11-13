-- Get all messages for a simulation chat
-- Parameters: $1=chat_id (uuid)
-- Returns: id, chat_id, type, content, created_at, completed
SELECT 
    id::text,
    chat_id::text,
    type,
    content,
    created_at,
    completed
FROM simulation_messages
WHERE chat_id = $1::uuid
ORDER BY created_at

