-- Get scenarios that already have graded chats (completed with grade) for an attempt
-- Parameters: $1=attempt_id (uuid)
-- Returns: scenario_id
SELECT DISTINCT sc.scenario_id
FROM attempt_chats ac
JOIN simulation_chats sc ON sc.id = ac.chat_id
JOIN simulation_chat_grades scg ON scg.simulation_chat_id = sc.id
WHERE ac.attempt_id = $1::uuid AND sc.completed = true
