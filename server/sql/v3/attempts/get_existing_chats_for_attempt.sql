-- Get all chats for an attempt
-- Parameters: $1=attempt_id (uuid)
-- Returns: id, completed, scenario_id
SELECT sc.id, sc.completed, sc.scenario_id
FROM attempt_chats ac
JOIN simulation_chats sc ON sc.id = ac.chat_id
WHERE ac.attempt_id = $1::uuid
ORDER BY sc.created_at

