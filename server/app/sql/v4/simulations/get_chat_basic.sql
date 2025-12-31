-- Get basic chat info
-- Parameters: $1=chat_id (uuid)
-- Returns: id, completed, scenario_id
SELECT id, completed, scenario_id
FROM chats
WHERE id = $1::uuid

