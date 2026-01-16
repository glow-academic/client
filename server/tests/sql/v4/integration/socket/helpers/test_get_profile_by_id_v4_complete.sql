-- Get profile by ID for test verification
-- Returns profile active status
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
    SELECT EXISTS (SELECT 1 FROM profile_flags pf JOIN flags_resource fl ON pf.flag_id = fl.id WHERE pf.profile_id = p.id AND fl.name = 'active'  AND pf.value = TRUE) as active
    FROM profiles_resource p
    WHERE p.id = test_get_profile_by_id_v4.profile_id;
$$;