-- Create a tool call
-- Parameters: $1=call_id (text), $2=tool_name (text)
-- Returns: id, created_at
INSERT INTO tool_calls (call_id, tool_name, completed, created_at, updated_at)
VALUES ($1::text, $2::text, FALSE, NOW(), NOW())
RETURNING id, created_at

