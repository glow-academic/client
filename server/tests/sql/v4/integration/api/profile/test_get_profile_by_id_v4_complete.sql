-- Get profile by ID for test verification
-- Returns profile details for assertions
-- Drop function if exists
DROP FUNCTION IF EXISTS test_get_profile_by_id_v4(uuid);

-- Create function
CREATE OR REPLACE FUNCTION test_get_profile_by_id_v4(
    input_profile_id uuid
)
RETURNS TABLE (
    profile_id uuid,
    first_name text,
    last_name text,
    role text,
    active boolean,
    last_login timestamptz,
    created_at timestamptz,
    updated_at timestamptz
)
LANGUAGE sql
STABLE
AS $$
    SELECT 
        p.id AS profile_id,
        (SELECT n.name FROM profile_names pn JOIN names n ON pn.name_id = n.id WHERE pn.profile_id = p.id AND pn.type = 'first' LIMIT 1) AS first_name,
        (SELECT n.name FROM profile_names pn JOIN names n ON pn.name_id = n.id WHERE pn.profile_id = p.id AND pn.type = 'last' LIMIT 1) AS last_name,
        p.role::text,
        EXISTS (SELECT 1 FROM profile_flags pf JOIN flags fl ON pf.flag_id = fl.id WHERE pf.profile_id = p.id AND fl.name = 'active' AND pf.type = 'active'::type_profile_flags AND pf.value = TRUE) AS active,
        p.last_login,
        p.created_at,
        p.updated_at
    FROM profiles p
    WHERE p.id = input_profile_id;
$$;