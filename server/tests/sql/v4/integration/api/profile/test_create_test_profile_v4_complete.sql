-- Create a test profile for test setup
-- Returns profile data for assertions
-- Drop function if exists
DROP FUNCTION IF EXISTS test_create_test_profile_v4(text, text, text, boolean, boolean);

-- Create function
CREATE OR REPLACE FUNCTION test_create_test_profile_v4(
    profile_first_name text,
    profile_last_name text,
    profile_role text DEFAULT 'guest',
    profile_active boolean DEFAULT true
)
RETURNS TABLE (
    profile_id uuid,
    first_name text,
    last_name text,
    role text,
    active boolean,
    created_at timestamptz,
    updated_at timestamptz
)
LANGUAGE sql
VOLATILE
AS $$
    WITH name_resource AS (
        INSERT INTO names_resource(name)
        VALUES (CONCAT_WS(' ', profile_first_name, profile_last_name))
        RETURNING id
    ),
    active_flag AS (
        SELECT id FROM flags_resource WHERE name = 'active' LIMIT 1
    ),
    new_profile AS (
        INSERT INTO profiles_resource(role)
        VALUES (profile_role::profile_type)
        RETURNING id, created_at, updated_at
    ),
    profile_name_link AS (
        INSERT INTO profile_names(profile_id, name_id)
        SELECT np.id, nr.id
        FROM new_profile np, name_resource nr
        RETURNING profile_id
    ),
    profile_flag_link AS (
        INSERT INTO profile_flags (profile_id, flag_id, value)
        SELECT np.id, af.id, profile_active
        FROM new_profile np, active_flag af
        RETURNING profile_id
    )
    SELECT 
        np.id AS profile_id,
        profile_first_name AS first_name,
        profile_last_name AS last_name,
        (SELECT role::text FROM profiles_resource p WHERE p.id = np.id) AS role,
        EXISTS (SELECT 1 FROM profile_flags pf JOIN flags_resource fl ON pf.flag_id = fl.id WHERE pf.profile_id = np.id AND fl.name = 'active'  AND pf.value = TRUE) AS active,
        np.created_at,
        np.updated_at
    FROM new_profile np;
$$;
