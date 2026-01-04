-- Create a test profile for test setup
-- Returns profile_id and email for use in tests
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
    WITH new_profile AS (
        INSERT INTO profiles(first_name, last_name, role, active)
        VALUES (
            test_create_test_profile_v4.first_name,
            test_create_test_profile_v4.last_name,
            test_create_test_profile_v4.role::profile_role,
            true
        )
        RETURNING id, role::text
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