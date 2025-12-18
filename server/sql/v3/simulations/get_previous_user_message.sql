-- Get the previous user message for a chat, ordered by creation time
-- Used for retry branching - finds the user message that should be the parent of a retry response
-- Parameters: $1=chat_id (uuid)
-- Returns: id, chat_id, role, content, created_at, completed, updated_at
-- Returns the most recent user message before any given point
SELECT 
    m.id,
    cm.chat_id,
    m.role,
    m.content,
    m.created_at,
    m.completed,
    m.updated_at
FROM messages m
JOIN chat_messages cm ON cm.message_id = m.id
WHERE cm.chat_id = $1::uuid
  AND m.role = 'user'
ORDER BY m.created_at DESC
LIMIT 1

