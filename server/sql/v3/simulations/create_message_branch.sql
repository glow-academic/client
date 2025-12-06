-- Create a message tree entry linking parent to child
-- Parameters: $1=parent_id (uuid), $2=child_id (uuid)
-- Returns: parent_id, child_id, active, created_at, updated_at
-- Note: Deactivates any existing active parent for the child, then creates/activates the new parent-child link
WITH deactivate_existing AS (
    -- Deactivate any existing active parent for this child (enforces single parent per child)
    UPDATE message_tree
    SET active = false, updated_at = NOW()
    WHERE child_id = $2::uuid 
    AND active = true
    AND parent_id != $1::uuid
),
upsert_branch AS (
    INSERT INTO message_tree (parent_id, child_id, active, created_at, updated_at)
    VALUES ($1::uuid, $2::uuid, true, NOW(), NOW())
    ON CONFLICT (parent_id, child_id) 
    DO UPDATE SET 
        active = true,
        updated_at = NOW()
    RETURNING parent_id, child_id, active, created_at, updated_at
)
SELECT parent_id, child_id, active, created_at, updated_at FROM upsert_branch

