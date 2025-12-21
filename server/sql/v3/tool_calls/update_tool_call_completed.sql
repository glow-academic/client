-- Update tool call to mark as completed
-- Parameters: $1=tool_call_id (uuid)
UPDATE tool_calls
SET completed = TRUE, updated_at = NOW()
WHERE id = $1::uuid

