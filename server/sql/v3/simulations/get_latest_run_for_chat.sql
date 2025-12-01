-- Get the latest run_id for a chat
-- Parameters: $1=chat_id (uuid)
-- Returns: run_id (uuid as text)
SELECT cr.run_id::text as run_id
FROM chat_runs cr
JOIN runs r ON r.id = cr.run_id
WHERE cr.chat_id = $1::uuid
ORDER BY r.created_at DESC
LIMIT 1

