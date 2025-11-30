-- Get the previous user message (query type) for a chat, ordered by creation time
-- Used for retry branching - finds the user message that should be the parent of a retry response
-- Parameters: $1=chat_id (uuid)
-- Returns: id, chat_id, type, content, created_at, completed, updated_at
-- Returns the most recent user message (query type) before any given point
SELECT 
    id,
    chat_id,
    type,
    content,
    created_at,
    completed,
    updated_at
FROM messages
WHERE chat_id = $1::uuid
  AND type = 'query'
ORDER BY created_at DESC
LIMIT 1

