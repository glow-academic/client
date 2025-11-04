-- Get all tool calls for a chat
-- Parameters: $1 = chat_id (uuid)
SELECT 
    id,
    created_at,
    updated_at,
    chat_id,
    tool_name,
    tool_type,
    tool_arguments,
    tool_result,
    completed
FROM assistant_tool_calls
WHERE chat_id = $1
ORDER BY created_at ASC

