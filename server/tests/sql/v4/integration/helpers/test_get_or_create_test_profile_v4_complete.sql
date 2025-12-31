-- Get existing profile by email or create a new one
-- Returns profile_id for use in tests

BEGIN;

-- Drop function if exists
DROP FUNCTION IF EXISTS test_get_or_create_test_profile_v4(text, text, text, text);

-- Create function
CREATE OR REPLACE FUNCTION test_get_or_create_test_profile_v4(
    email text DEFAULT 'redacted@purdue.edu',
    role text DEFAULT 'superadmin',
    first_name text DEFAULT 'Test',
    last_name text DEFAULT 'User'
)
RETURNS TABLE (
    profile_id uuid,
    email text,
    role text
)
LANGUAGE sql
VOLATILE
AS $$
    WITH existing_profile AS (
        SELECT 
            pe.profile_id,
            pe.email,
            p.role::text
        FROM profile_emails pe
        JOIN profiles p ON p.id = pe.profile_id
        WHERE pe.email = test_get_or_create_test_profile_v4.email
          AND pe.active = true
        LIMIT 1
    ),
    new_profile AS (
        INSERT INTO profiles(first_name, last_name, role, active)
        SELECT 
            test_get_or_create_test_profile_v4.first_name,
            test_get_or_create_test_profile_v4.last_name,
            test_get_or_create_test_profile_v4.role::profile_role,
            true
        WHERE NOT EXISTS (SELECT 1 FROM existing_profile)
        RETURNING id, test_get_or_create_test_profile_v4.role::text as role
    ),
    new_email AS (
        INSERT INTO profile_emails(profile_id, email, is_primary, active)
        SELECT 
            np.id,
            test_get_or_create_test_profile_v4.email,
            true,
            true
        FROM new_profile np
        WHERE NOT EXISTS (SELECT 1 FROM existing_profile)
        RETURNING profile_id, email
    )
    SELECT 
        COALESCE(ep.profile_id, np.id) as profile_id,
        COALESCE(ep.email, ne.email) as email,
        COALESCE(ep.role, np.role) as role
    FROM existing_profile ep
    FULL OUTER JOIN new_profile np ON true
    FULL OUTER JOIN new_email ne ON ne.profile_id = np.id
    WHERE ep.profile_id IS NOT NULL OR np.id IS NOT NULL
    LIMIT 1;
$$;

COMMIT;

