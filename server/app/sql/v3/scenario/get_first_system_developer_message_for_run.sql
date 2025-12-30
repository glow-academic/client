SELECT m.id as latest_message_id
FROM messages m
JOIN message_runs mr ON mr.message_id = m.id
WHERE mr.run_id = $1::uuid
  AND m.role IN ('system'::message_role, 'developer'::message_role)
ORDER BY m.created_at ASC
LIMIT 1
