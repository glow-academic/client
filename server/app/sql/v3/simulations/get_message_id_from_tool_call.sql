-- Get message_id from tool_call_id and run_id
-- Parameters: $1=tool_call_id (uuid), $2=run_id (uuid)
-- Returns: message_id (uuid)
SELECT DISTINCT m.id as message_id
FROM tool_calls tc
JOIN tool_call_runs tcr ON tcr.tool_call_id = tc.id
JOIN message_runs mr ON mr.run_id = tcr.run_id
JOIN messages m ON m.id = mr.message_id
WHERE tc.id = $1::uuid
  AND tcr.run_id = $2::uuid
  AND m.role = message_role.assistant
ORDER BY m.created_at DESC
LIMIT 1

