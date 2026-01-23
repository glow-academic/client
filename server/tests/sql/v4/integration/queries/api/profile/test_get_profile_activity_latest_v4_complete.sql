-- Get latest profile activity_entry for test verification
-- Returns latest activity_entry record
-- Drop function if exists
DROP FUNCTION IF EXISTS test_get_profile_activity_latest_v4(uuid);

-- Create function
CREATE OR REPLACE FUNCTION test_get_profile_activity_latest_v4(
    input_profile_id uuid
)
RETURNS TABLE (
    profile_id uuid,
    last_active timestamptz,
    created_at timestamptz
)
LANGUAGE sql
STABLE
AS $$
    SELECT 
        profile_id,
        last_active,
        created_at
    FROM activity_entry
    WHERE profile_id = input_profile_id
    ORDER BY created_at DESC
    LIMIT 1;
$$;