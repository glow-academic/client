-- Get the previous user message for a chat, ordered by creation time
-- Used for retry branching - finds the user message that should be the parent of a retry response
-- Parameters: $1=chat_id (uuid)
-- Returns: id, chat_id, role, content, created_at, completed, updated_at
-- Returns the most recent user message before any given point
SELECT 
    m.id,
    c.id AS chat_id,
    m.role,
    m.content,
    m.created_at,
    m.completed,
    m.updated_at
FROM chats c
JOIN chat_groups cg ON cg.chat_id = c.id
JOIN groups g ON g.id = cg.group_id
JOIN group_runs gr ON gr.group_id = g.id
JOIN runs r ON r.id = gr.run_id
JOIN message_runs mr ON mr.run_id = r.id
JOIN messages m ON m.id = mr.message_id
WHERE c.id = $1::uuid
  AND m.role = 'user'
ORDER BY m.created_at DESC
LIMIT 1

