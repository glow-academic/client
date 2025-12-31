-- Get tools in group_stop for a group (ordered by position_idx)
-- Parameters: $1=group_id (uuid)
-- Returns: tool_id (uuid), position_idx (integer)
SELECT 
    tool_id::uuid,
    position_idx
FROM group_stop
WHERE group_id = $1::uuid
ORDER BY position_idx ASC

