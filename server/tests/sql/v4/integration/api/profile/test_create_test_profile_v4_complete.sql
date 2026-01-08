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
    WITH first_name_resource AS (
        INSERT INTO names(name)
        VALUES (profile_first_name)
        RETURNING id
    ),
    last_name_resource AS (
        INSERT INTO names(name)
        VALUES (profile_last_name)
        RETURNING id
    ),
    active_flag AS (
        SELECT id FROM flags WHERE name = 'active' LIMIT 1
    ),
    new_profile AS (
        INSERT INTO profiles(role)
        VALUES (profile_role::profile_role)
        RETURNING id, created_at, updated_at
    ),
    profile_first_name_link AS (
        INSERT INTO profile_names(profile_id, name_id, type)
        SELECT np.id, fnr.id, 'first'::type_profile_names
        FROM new_profile np, first_name_resource fnr
        RETURNING profile_id
    ),
    profile_last_name_link AS (
        INSERT INTO profile_names(profile_id, name_id, type)
        SELECT np.id, lnr.id, 'last'::type_profile_names
        FROM new_profile np, last_name_resource lnr
        RETURNING profile_id
    ),
    profile_flag_link AS (
        INSERT INTO profile_flags(profile_id, flag_id, type, value)
        SELECT np.id, af.id, 'active'::type_profile_flags, profile_active
        FROM new_profile np, active_flag af
        RETURNING profile_id
    )
    SELECT 
        np.id AS profile_id,
        (SELECT n.name FROM profile_names pn JOIN names n ON pn.name_id = n.id WHERE pn.profile_id = np.id AND pn.type = 'first' LIMIT 1) AS first_name,
        (SELECT n.name FROM profile_names pn JOIN names n ON pn.name_id = n.id WHERE pn.profile_id = np.id AND pn.type = 'last' LIMIT 1) AS last_name,
        (SELECT role::text FROM profiles p WHERE p.id = np.id) AS role,
        EXISTS (SELECT 1 FROM profile_flags pf JOIN flags fl ON pf.flag_id = fl.id WHERE pf.profile_id = np.id AND fl.name = 'active' AND pf.type = 'active'::type_profile_flags AND pf.value = TRUE) AS active,
        np.created_at,
        np.updated_at
    FROM new_profile np;
$$;