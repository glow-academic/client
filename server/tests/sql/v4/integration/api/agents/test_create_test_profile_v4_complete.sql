-- Create a test profile for test setup
-- Returns profile_id and email for use in tests_entry
-- Drop function if exists
DROP FUNCTION IF EXISTS test_create_test_profile_v4(text, text, text, text);

-- Create function
CREATE OR REPLACE FUNCTION test_create_test_profile_v4(
    first_name text DEFAULT 'Test',
    last_name text DEFAULT 'User',
    role text DEFAULT 'member',
    email text DEFAULT NULL
)
RETURNS TABLE (
    profile_id uuid,
    email text,
    role text
)
LANGUAGE sql
VOLATILE
AS $$
    WITH name_resource AS (
        INSERT INTO names_resource(name)
        VALUES (CONCAT_WS(' ', test_create_test_profile_v4.first_name, test_create_test_profile_v4.last_name))
        RETURNING id
    ),
    active_flag AS (
        SELECT id FROM flags_resource WHERE name = 'active' LIMIT 1
    ),
    new_profile AS (
        INSERT INTO profiles_resource(role)
        VALUES (test_create_test_profile_v4.role::profile_type)
        RETURNING id, role::text
    ),
    profile_name_link AS (
        INSERT INTO profile_names(profile_id, name_id)
        SELECT np.id, nr.id
        FROM new_profile np, name_resource nr
        RETURNING profile_id
    ),
    profile_flag_link AS (
        INSERT INTO profile_flags (profile_id, flag_id, value)
        SELECT np.id, af.id, true
        FROM new_profile np, active_flag af
        RETURNING profile_id
    ),
    new_email AS (
        INSERT INTO profile_emails(profile_id, email, is_primary, active)
        SELECT 
            np.id,
            COALESCE(test_create_test_profile_v4.email, 'test_' || np.id::text || '@purdue.edu'),
            true,
            true
        FROM new_profile np
        RETURNING profile_id, email
    )
    SELECT 
        np.id as profile_id,
        ne.email,
        np.role
    FROM new_profile np
    JOIN new_email ne ON ne.profile_id = np.id;
$$;
