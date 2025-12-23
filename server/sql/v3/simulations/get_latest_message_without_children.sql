-- Get latest message with no active children for branching
-- Parameters: $1=chat_id (uuid), $2=exclude_message_id (uuid)
-- Returns: id (uuid)
SELECT m.id
FROM messages m
JOIN message_runs mr ON mr.message_id = m.id
JOIN runs r ON r.id = mr.run_id
JOIN group_runs gr ON gr.run_id = r.id
JOIN groups g ON g.id = gr.group_id
JOIN chat_groups cg ON cg.group_id = g.id
JOIN chats c ON c.id = cg.chat_id
WHERE c.id = $1::uuid
  AND m.id != $2::uuid
  AND NOT EXISTS (
      SELECT 1 FROM message_tree mt 
      WHERE mt.parent_id = m.id AND mt.active = true
  )
ORDER BY m.created_at DESC
LIMIT 1

