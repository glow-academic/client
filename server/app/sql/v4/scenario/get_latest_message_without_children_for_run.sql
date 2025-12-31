SELECT m.id as latest_message_id
FROM messages m
JOIN message_runs mr ON mr.message_id = m.id
WHERE mr.run_id = $1::uuid
  AND NOT EXISTS (
      SELECT 1 FROM message_tree mt
      WHERE mt.parent_id = m.id AND mt.active = true
  )
ORDER BY m.created_at DESC
LIMIT 1
