-- Link a tool call to a run via tool_call_runs junction table
-- Parameters: $1=tool_call_id (uuid), $2=run_id (uuid)
-- Returns: tool_call_id, run_id, created_at, updated_at
-- Note: If link already exists, it will be updated
INSERT INTO tool_call_runs (tool_call_id, run_id, created_at, updated_at)
VALUES ($1::uuid, $2::uuid, NOW(), NOW())
ON CONFLICT (tool_call_id, run_id) 
DO UPDATE SET 
    updated_at = NOW()
RETURNING tool_call_id, run_id, created_at, updated_at

