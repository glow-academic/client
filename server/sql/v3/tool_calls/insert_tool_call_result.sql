-- Insert tool call result
-- Parameters: $1=tool_call_id (uuid), $2=result_content (text), $3=result_json (jsonb, nullable)
-- Returns: tool_call_id, result_content, result_json, created_at
INSERT INTO tool_call_results (tool_call_id, result_content, result_json, created_at)
VALUES ($1::uuid, $2::text, $3::jsonb, NOW())
ON CONFLICT (tool_call_id) 
DO UPDATE SET 
    result_content = $2::text,
    result_json = $3::jsonb
RETURNING tool_call_id, result_content, result_json, created_at

