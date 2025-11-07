-- Update a tool call with its result and mark as completed
-- Parameters: $1=tool_call_id (uuid), $2=tool_result (text, JSON), $3=completed (boolean)
UPDATE assistant_tool_calls 
SET tool_result = $2::jsonb, completed = $3::bool, updated_at = NOW()
WHERE id = $1::uuid

