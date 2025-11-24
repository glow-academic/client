-- Create a message tree entry linking parent to child
-- Parameters: $1=parent_id (uuid), $2=child_id (uuid)
-- Returns: parent_id, child_id, active, created_at, updated_at
-- Note: If entry already exists, it will be updated to active=true
INSERT INTO message_tree (parent_id, child_id, active, created_at, updated_at)
VALUES ($1::uuid, $2::uuid, true, NOW(), NOW())
ON CONFLICT (parent_id, child_id) 
DO UPDATE SET 
    active = true,
    updated_at = NOW()
RETURNING parent_id, child_id, active, created_at, updated_at

