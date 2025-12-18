-- Update tool call arguments (for delta events - accumulates arguments)
-- Parameters: $1=tool_call_id (uuid), $2=arguments_raw (text)
-- Note: This creates or updates the arguments row, parsing JSONB from raw text
-- If arguments_json parsing fails, stores empty JSONB object
INSERT INTO tool_call_arguments (tool_call_id, arguments_json, arguments_raw, created_at)
VALUES (
    $1::uuid,
    COALESCE(($2::text)::jsonb, '{}'::jsonb),
    $2::text,
    NOW()
)
ON CONFLICT (tool_call_id) 
DO UPDATE SET 
    arguments_json = COALESCE(($2::text)::jsonb, tool_call_arguments.arguments_json),
    arguments_raw = $2::text
RETURNING tool_call_id, arguments_json, arguments_raw, created_at

