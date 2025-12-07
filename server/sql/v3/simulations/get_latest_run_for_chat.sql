-- Get the latest run for a chat
-- Parameters: $1=chat_id (uuid)
-- Returns: run_id (uuid as text) for the most recent run linked to this chat
SELECT cr.run_id::text as run_id
FROM chat_runs cr
JOIN runs r ON r.id = cr.run_id
WHERE cr.chat_id = $1::uuid
ORDER BY r.created_at DESC
LIMIT 1
