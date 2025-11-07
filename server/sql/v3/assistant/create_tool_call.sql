-- Create a new assistant tool call
-- Parameters: $1=chat_id (uuid), $2=tool_name (text), $3=tool_type (text), $4=tool_arguments (text, JSON), $5=created_at (timestamp with time zone)
-- Returns: id
INSERT INTO assistant_tool_calls 
(chat_id, tool_name, tool_type, tool_arguments, tool_result, completed, created_at)
VALUES ($1::uuid, $2::text, $3::text, $4::text, '{}'::jsonb, false, $5::timestamp with time zone)
RETURNING id

