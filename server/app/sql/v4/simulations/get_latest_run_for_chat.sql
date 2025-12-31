-- Get the latest run for a chat (now uses groups)
-- Parameters: $1=chat_id (uuid)
-- Returns: run_id (uuid as text) for the most recent run linked to this chat's group
SELECT gr.run_id::text as run_id
FROM chats c
JOIN chat_groups cg ON cg.chat_id = c.id
JOIN groups g ON g.id = cg.group_id
JOIN group_runs gr ON gr.group_id = g.id
JOIN runs r ON r.id = gr.run_id
WHERE c.id = $1::uuid
ORDER BY r.created_at DESC
LIMIT 1
