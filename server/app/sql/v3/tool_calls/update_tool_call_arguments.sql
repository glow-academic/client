-- Update tool call arguments (for delta events - accumulates arguments)
-- Parameters: $1=tool_call_id (uuid), $2=arguments_raw (text)
-- Note: This creates or updates the arguments row, parsing JSONB from raw text
-- Uses safe_jsonb_parse() function to handle invalid JSON during streaming
-- If arguments_json parsing fails, keeps previous value or defaults to empty JSONB object
INSERT INTO tool_call_arguments (tool_call_id, arguments_json, arguments_raw, created_at)
VALUES (
    $1::uuid,
    COALESCE(safe_jsonb_parse($2::text), '{}'::jsonb),
    $2::text,
    NOW()
)
ON CONFLICT (tool_call_id) 
DO UPDATE SET 
    arguments_json = COALESCE(safe_jsonb_parse($2::text), tool_call_arguments.arguments_json),
    arguments_raw = $2::text
RETURNING tool_call_id, arguments_json, arguments_raw, created_at

