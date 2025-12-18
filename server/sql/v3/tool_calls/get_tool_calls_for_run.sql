-- Get all tool calls for a run, ordered by creation time
-- Parameters: $1=run_id (uuid)
-- Returns: tool_call_id, call_id, tool_name, completed, 
--          arguments_json, arguments_raw, result_content, result_json,
--          tool_call_created_at, arguments_created_at, result_created_at
SELECT 
    tc.id AS tool_call_id,
    tc.call_id,
    tc.tool_name,
    tc.completed,
    tca.arguments_json,
    tca.arguments_raw,
    tcr.result_content,
    tcr.result_json,
    tc.created_at AS tool_call_created_at,
    tca.created_at AS arguments_created_at,
    tcr.created_at AS result_created_at
FROM tool_call_runs tcr_junc
JOIN tool_calls tc ON tc.id = tcr_junc.tool_call_id
LEFT JOIN tool_call_arguments tca ON tca.tool_call_id = tc.id
LEFT JOIN tool_call_results tcr ON tcr.tool_call_id = tc.id
WHERE tcr_junc.run_id = $1::uuid
ORDER BY tc.created_at ASC

