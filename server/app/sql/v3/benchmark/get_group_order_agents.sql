-- Get agents in group_order for a group (ordered by position_idx)
-- Parameters: $1=group_id (uuid)
-- Returns: agent_id (uuid), position_idx (integer)
SELECT 
    agent_id::uuid,
    position_idx
FROM group_order
WHERE group_id = $1::uuid
ORDER BY position_idx ASC

