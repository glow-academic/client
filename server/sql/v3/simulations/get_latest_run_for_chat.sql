-- Get the latest run for a chat (now uses groups)
-- Parameters: $1=chat_id (uuid)
-- Returns: run_id (uuid as text) for the most recent run linked to this chat's group
SELECT gr.run_id::text as run_id
FROM chat_messages cm
JOIN message_runs mr ON mr.message_id = cm.message_id
JOIN group_runs gr ON gr.run_id = mr.run_id
JOIN runs r ON r.id = gr.run_id
WHERE cm.chat_id = $1::uuid
ORDER BY r.created_at DESC
LIMIT 1
