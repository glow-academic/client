-- Delete feedback with role validation in single transaction
-- Parameters:
--   $1 = profile_id (uuid) - profile ID to check role
--   $2 = feedback_ids (int[]) - array of feedback IDs to delete
-- Returns: deleted_count (integer)

WITH profile_role_check AS (
    -- Check if user is superadmin
    SELECT role FROM profiles WHERE id = $1::uuid
),
authorized_delete AS (
    -- Only delete if user is superadmin
    DELETE FROM app_feedback
    WHERE id = ANY($2::int[])
      AND EXISTS (
          SELECT 1 FROM profile_role_check WHERE role = 'superadmin'
      )
    RETURNING id
)
SELECT COUNT(*)::integer as deleted_count
FROM authorized_delete

