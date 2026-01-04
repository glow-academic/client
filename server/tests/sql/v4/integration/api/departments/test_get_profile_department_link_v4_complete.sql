-- Get profile-department link for test verification
-- Returns link data for assertions

BEGIN;

-- Drop function if exists
DROP FUNCTION IF EXISTS test_get_profile_department_link_v4(uuid, uuid);

-- Create function
CREATE OR REPLACE FUNCTION test_get_profile_department_link_v4(
    input_department_id uuid,
    input_profile_id uuid
)
RETURNS TABLE (
    department_id uuid,
    profile_id uuid,
    active boolean,
    created_at timestamptz
)
LANGUAGE sql
STABLE
AS $$
    SELECT 
        department_id,
        profile_id,
        active,
        created_at
    FROM profile_departments
    WHERE department_id = test_get_profile_department_link_v4.input_department_id
      AND profile_id = test_get_profile_department_link_v4.input_profile_id;
$$;

COMMIT;

