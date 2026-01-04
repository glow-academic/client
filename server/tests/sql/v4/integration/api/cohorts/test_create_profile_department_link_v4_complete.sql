-- Create a profile department link for test setup
-- Returns link data for assertions
-- Drop function if exists
DROP FUNCTION IF EXISTS test_create_profile_department_link_v4(uuid, uuid);

-- Create function
CREATE OR REPLACE FUNCTION test_create_profile_department_link_v4(
    profile_id uuid,
    department_id uuid
)
RETURNS TABLE (
    profile_id uuid,
    department_id uuid,
    active boolean,
    created_at timestamptz
)
LANGUAGE sql
VOLATILE
AS $$
    INSERT INTO profile_departments(profile_id, department_id, active)
    VALUES (
        test_create_profile_department_link_v4.profile_id,
        test_create_profile_department_link_v4.department_id,
        true
    )
    ON CONFLICT (profile_id, department_id) DO NOTHING
    RETURNING profile_id, department_id, active, created_at;
$$;