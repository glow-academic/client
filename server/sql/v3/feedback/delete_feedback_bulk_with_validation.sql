-- Delete feedback with role validation in single transaction
-- Parameters:
--   $1 = profile_id (uuid) - profile ID to check role
--   $2 = feedback_ids (uuid[]) - array of feedback IDs to delete
-- Returns: deleted_count (integer), profile_role (text)

WITH profile_role_check AS (
    -- Check if user is superadmin
    SELECT role FROM profiles WHERE id = $1::uuid
),
authorized_delete AS (
    -- Only delete if user is superadmin
    DELETE FROM feedback
    WHERE id = ANY($2::uuid[])
      AND EXISTS (
          SELECT 1 FROM profile_role_check WHERE role = 'superadmin'
      )
    RETURNING id
)
SELECT 
    COALESCE((SELECT COUNT(*)::integer FROM authorized_delete), 0) as deleted_count,
    (SELECT role FROM profile_role_check) as profile_role

