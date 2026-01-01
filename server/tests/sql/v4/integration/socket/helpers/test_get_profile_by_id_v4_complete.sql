-- Get profile by ID for test verification
-- Returns profile active status

BEGIN;

-- Drop function if exists
DROP FUNCTION IF EXISTS test_get_profile_by_id_v4(uuid);

-- Create function
CREATE OR REPLACE FUNCTION test_get_profile_by_id_v4(
    profile_id uuid
)
RETURNS TABLE (
    active boolean
)
LANGUAGE sql
STABLE
AS $$
    SELECT active FROM profiles WHERE id = test_get_profile_by_id_v4.profile_id;
$$;

COMMIT;

