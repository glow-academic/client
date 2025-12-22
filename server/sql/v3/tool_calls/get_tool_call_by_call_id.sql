-- Get tool call by call_id (OpenAI SDK identifier)
-- Parameters: $1=call_id (text)
-- Returns: id, call_id, item_id, response_id, tool_id, tool_name, completed, created_at, updated_at
SELECT 
    tc.id, 
    tc.call_id, 
    tc.item_id, 
    tc.response_id, 
    tc.tool_id,
    t.name AS tool_name,
    tc.completed, 
    tc.created_at, 
    tc.updated_at
FROM tool_calls tc
LEFT JOIN tools t ON t.id = tc.tool_id
WHERE tc.call_id = $1::text
LIMIT 1

