-- Bulk delete logs with role check in a single transaction
-- Parameters: $1=profileId, $2=log_ids (int array)
-- Returns: deleted_count, role (or no rows if profile not found)
-- If role != 'superadmin', no logs are deleted but row is still returned (caller should raise 403 error)
-- If no rows returned, profile doesn't exist (caller should raise 404 error)
WITH profile_check AS (
    -- Check if profile exists and get role
    SELECT id, role
    FROM profiles
    WHERE id = $1::uuid
),
role_validation AS (
    -- Only proceed if profile is superadmin
    SELECT id, role
    FROM profile_check
    WHERE role = 'superadmin'
),
delete_logs AS (
    -- Delete logs only if profile is superadmin
    DELETE FROM app_logs
    WHERE id = ANY($2::int[])
    AND EXISTS (SELECT 1 FROM role_validation)
    RETURNING id
)
-- Return deleted count and role (even if no logs deleted, so caller can determine error)
SELECT 
    COUNT(dl.id)::int as deleted_count,
    pc.role
FROM profile_check pc
LEFT JOIN role_validation rv ON rv.id = pc.id
LEFT JOIN delete_logs dl ON true
GROUP BY pc.role

