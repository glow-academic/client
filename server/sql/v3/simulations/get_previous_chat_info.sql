-- Get previous chat info (scenario_id and whether it has a grade)
-- Parameters: $1=chat_id (uuid)
-- Returns: scenario_id, has_grade (boolean)
SELECT sc.scenario_id, cm_prev.chat_id IS NOT NULL as has_grade
FROM chats sc
LEFT JOIN grades scg ON EXISTS (
    SELECT 1 FROM message_runs mr_check
    JOIN chat_messages cm_check ON cm_check.message_id = mr_check.message_id
    WHERE mr_check.run_id = scg.run_id AND cm_check.chat_id = sc.id
)
LEFT JOIN runs r_prev ON r_prev.id = scg.run_id
LEFT JOIN message_runs mr_prev ON mr_prev.run_id = r_prev.id
LEFT JOIN chat_messages cm_prev ON cm_prev.message_id = mr_prev.message_id AND cm_prev.chat_id = sc.id
WHERE sc.id = $1::uuid AND sc.completed = true
