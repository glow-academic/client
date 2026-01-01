-- Create a test guest profile for socket tests
-- Returns guest_id and email

BEGIN;

-- Drop function if exists
DROP FUNCTION IF EXISTS test_create_test_guest_profile_v4(text);

-- Create function
CREATE OR REPLACE FUNCTION test_create_test_guest_profile_v4(
    email text DEFAULT 'redacted@purdue.edu'
)
RETURNS TABLE (
    guest_id uuid,
    email text
)
LANGUAGE sql
VOLATILE
AS $$
    WITH new_profile AS (
        INSERT INTO profiles(first_name, last_name, role, active) 
        VALUES ('Guest', 'User', 'guest', true) 
        RETURNING id
    ),
    new_email AS (
        INSERT INTO profile_emails(profile_id, email, is_primary, active) 
        SELECT id, test_create_test_guest_profile_v4.email, true, true
        FROM new_profile
        RETURNING profile_id, email
    )
    SELECT np.id as guest_id, ne.email
    FROM new_profile np
    JOIN new_email ne ON ne.profile_id = np.id;
$$;

COMMIT;

