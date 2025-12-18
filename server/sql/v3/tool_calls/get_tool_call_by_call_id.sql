-- Get tool call by call_id (OpenAI SDK identifier)
-- Parameters: $1=call_id (text)
-- Returns: id, call_id, item_id, response_id, tool_name, completed, created_at, updated_at
SELECT id, call_id, item_id, response_id, tool_name, completed, created_at, updated_at
FROM tool_calls
WHERE call_id = $1::text
LIMIT 1

