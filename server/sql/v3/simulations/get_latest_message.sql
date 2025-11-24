-- Get the latest message(s) for a chat (messages with no active children in message_tree)
-- Parameters: $1=chat_id (uuid)
-- Returns: id, chat_id, type, content, created_at, completed, updated_at
-- Returns NULL if no messages exist
SELECT 
    id,
    chat_id,
    type,
    content,
    created_at,
    completed,
    updated_at
FROM simulation_messages
WHERE chat_id = $1::uuid
  AND NOT EXISTS (
      SELECT 1 FROM message_tree mt 
      WHERE mt.parent_id = simulation_messages.id AND mt.active = true
  )
ORDER BY created_at DESC
LIMIT 1

