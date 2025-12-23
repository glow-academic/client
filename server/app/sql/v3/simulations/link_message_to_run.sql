-- Link a message to a run via message_runs junction table
-- Parameters: $1=message_id (uuid), $2=run_id (uuid)
-- Returns: message_id, run_id, created_at, updated_at
-- Note: If link already exists, it will be updated
INSERT INTO message_runs (message_id, run_id, created_at, updated_at)
VALUES ($1::uuid, $2::uuid, NOW(), NOW())
ON CONFLICT (message_id, run_id) 
DO UPDATE SET 
    updated_at = NOW()
RETURNING message_id, run_id, created_at, updated_at

