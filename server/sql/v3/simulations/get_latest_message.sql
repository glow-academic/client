-- Get the latest message(s) for a chat (messages with no active children in message_tree)
-- Parameters: $1=chat_id (uuid)
-- Returns: id, chat_id, role, content, created_at, completed, updated_at
-- Returns NULL if no messages exist
SELECT 
    m.id,
    c.id AS chat_id,
    m.role,
    m.content,
    m.created_at,
    m.completed,
    m.updated_at
FROM chats c
JOIN groups g ON g.id = c.group_id
JOIN group_runs gr ON gr.group_id = g.id
JOIN runs r ON r.id = gr.run_id
JOIN message_runs mr ON mr.run_id = r.id
JOIN messages m ON m.id = mr.message_id
WHERE c.id = $1::uuid
  AND NOT EXISTS (
      SELECT 1 FROM message_tree mt 
      WHERE mt.parent_id = m.id AND mt.active = true
  )
ORDER BY m.created_at DESC
LIMIT 1

