-- Finalize a tool call (mark as completed and store final arguments)
-- Parameters: $1=tool_call_id (uuid), $2=arguments_raw (text, final complete JSON string)
-- Updates both tool_calls.completed and tool_call_arguments with final arguments
-- Uses safe_jsonb_parse() function to handle any edge cases
UPDATE tool_calls
SET completed = TRUE, updated_at = NOW()
WHERE id = $1::uuid;

-- Update arguments with final version
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

