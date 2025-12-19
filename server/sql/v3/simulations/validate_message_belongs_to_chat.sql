-- Validate that a message belongs to a chat
-- Parameters: $1=chat_id (uuid), $2=message_id (uuid)
-- Returns: message_id if message belongs to chat, NULL otherwise
SELECT m.id
FROM messages m
JOIN message_runs mr ON mr.message_id = m.id
JOIN runs r ON r.id = mr.run_id
JOIN group_runs gr ON gr.run_id = r.id
JOIN groups g ON g.id = gr.group_id
JOIN chats c ON c.group_id = g.id
WHERE c.id = $1::uuid
  AND m.id = $2::uuid
LIMIT 1;

