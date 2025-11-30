-- Get previous chat info (scenario_id and whether it has a grade)
-- Parameters: $1=chat_id (uuid)
-- Returns: scenario_id, has_grade (boolean)
SELECT sc.scenario_id, scg.id IS NOT NULL as has_grade
FROM chats sc
LEFT JOIN grades scg ON scg.simulation_chat_id = sc.id
WHERE sc.id = $1::uuid AND sc.completed = true
