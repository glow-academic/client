-- Get profile activity_entry for test verification
-- Returns last_active timestamp
-- Drop function if exists
DROP FUNCTION IF EXISTS test_get_profile_activity_v4(uuid);

-- Create function
CREATE OR REPLACE FUNCTION test_get_profile_activity_v4(
    profile_id uuid
)
RETURNS TABLE (
    last_active timestamptz
)
LANGUAGE sql
STABLE
AS $$
    SELECT last_active
    FROM activity_entry
    WHERE profile_id = test_get_profile_activity_v4.profile_id 
    ORDER BY created_at DESC 
    LIMIT 1;
$$;