SELECT m.created_at
FROM messages m
JOIN message_runs mr ON mr.message_id = m.id
JOIN runs r ON r.id = mr.run_id
JOIN group_runs gr ON gr.run_id = r.id
JOIN groups g ON g.id = gr.group_id
JOIN chat_groups cg ON cg.group_id = g.id
JOIN chats c ON c.id = cg.chat_id
WHERE c.id = $1::uuid
  AND m.role = message_role.user
  AND m.id != $2::uuid
ORDER BY m.created_at DESC
LIMIT 1
