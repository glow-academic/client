-- Get previous chat info (scenario_id and whether it has a grade)
-- Parameters: $1=chat_id (uuid)
-- Returns: scenario_id, has_grade (boolean)
SELECT sc.scenario_id, c_prev.id IS NOT NULL as has_grade
FROM chats sc
LEFT JOIN grades scg ON EXISTS (
    SELECT 1 FROM runs r_check
    JOIN group_runs gr_check ON gr_check.run_id = r_check.id
    JOIN groups g_check ON g_check.id = gr_check.group_id
    JOIN chats c_check ON c_check.group_id = g_check.id
    WHERE r_check.id = scg.run_id AND c_check.id = sc.id
)
LEFT JOIN runs r_prev ON r_prev.id = scg.run_id
LEFT JOIN group_runs gr_prev ON gr_prev.run_id = r_prev.id
LEFT JOIN groups g_prev ON g_prev.id = gr_prev.group_id
LEFT JOIN chats c_prev ON c_prev.group_id = g_prev.id AND c_prev.id = sc.id
WHERE sc.id = $1::uuid AND sc.completed = true
