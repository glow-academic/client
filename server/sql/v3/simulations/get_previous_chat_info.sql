-- Get previous chat info (scenario_id and whether it has a grade)
-- Parameters: $1=chat_id (uuid)
-- Returns: scenario_id, has_grade (boolean)
SELECT sc.scenario_id, rc_prev.chat_id IS NOT NULL as has_grade
FROM chats sc
LEFT JOIN grades scg ON EXISTS (SELECT 1 FROM chat_runs cr_check WHERE cr_check.run_id = scg.run_id)
LEFT JOIN runs r_prev ON r_prev.id = scg.run_id
LEFT JOIN chat_runs rc_prev ON rc_prev.run_id = r_prev.id AND rc_prev.chat_id = sc.id
WHERE sc.id = $1::uuid AND sc.completed = true
