-- Get the latest message(s) for a chat (messages with no active children in message_tree)
-- Parameters: $1=chat_id (uuid)
-- Returns: id, chat_id, role, content, created_at, completed, updated_at
-- Returns NULL if no messages exist
SELECT 
    m.id,
    rc.chat_id,
    m.role,
    m.content,
    m.created_at,
    m.completed,
    m.updated_at
FROM messages m
JOIN message_runs mr ON mr.message_id = m.id
JOIN chat_runs rc ON rc.run_id = mr.run_id
WHERE rc.chat_id = $1::uuid
  AND NOT EXISTS (
      SELECT 1 FROM message_tree mt 
      WHERE mt.parent_id = m.id AND mt.active = true
  )
ORDER BY m.created_at DESC
LIMIT 1

