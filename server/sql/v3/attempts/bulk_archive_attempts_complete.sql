-- Bulk archive or unarchive simulation attempts in a single transaction
-- Parameters: $1=archived (bool), $2=attemptIds (uuid array)
-- Returns: count of updated attempts
WITH update_attempts AS (
    -- Update attempts that exist in the provided array
    UPDATE simulation_attempts
    SET archived = $1
    WHERE id = ANY($2::uuid[])
    RETURNING id
)
SELECT COUNT(*)::int as updated_count
FROM update_attempts

