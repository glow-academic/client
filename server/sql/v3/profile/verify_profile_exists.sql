-- Verify that a profile exists
-- Parameters: $1=profile_id (uuid)
-- Returns: id if profile exists, or no rows if profile doesn't exist
SELECT id::text
FROM profiles
WHERE id = $1::uuid

