-- Get tool_call by call_id
-- Parameters: $1=call_id (text)
-- Returns: id (uuid), call_id (text), tool_id (uuid), completed (boolean)
SELECT id, call_id, tool_id, completed
FROM tool_calls
WHERE call_id = $1::text
LIMIT 1

