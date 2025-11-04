-- Get all messages for a chat
-- Parameters: $1 = chat_id (uuid)
SELECT 
    id,
    created_at,
    updated_at,
    chat_id,
    role,
    content,
    completed
FROM assistant_messages
WHERE chat_id = $1
ORDER BY created_at ASC

