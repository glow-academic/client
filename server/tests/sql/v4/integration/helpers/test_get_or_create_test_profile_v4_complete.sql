-- Get existing profile by email or create a new one
-- Returns profile_id for use in tests_entry
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
        JOIN profiles_resource p ON p.id = pe.profile_id
        WHERE pe.email = test_get_or_create_test_profile_v4.email
          AND pe.active = true
        LIMIT 1
    ),
    name_resource AS (
        INSERT INTO names_resource(name)
        VALUES (CONCAT_WS(' ', test_get_or_create_test_profile_v4.first_name, test_get_or_create_test_profile_v4.last_name))
        ON CONFLICT (name) DO NOTHING
        RETURNING id
    ),
    name_lookup AS (
        SELECT id FROM names_resource
        WHERE name = CONCAT_WS(' ', test_get_or_create_test_profile_v4.first_name, test_get_or_create_test_profile_v4.last_name)
        LIMIT 1
    ),
    active_flag AS (
        SELECT id FROM flags_resource WHERE name = 'active' LIMIT 1
    ),
    new_profile AS (
        INSERT INTO profiles_resource(role)
        SELECT test_get_or_create_test_profile_v4.role::profile_role
        WHERE NOT EXISTS (SELECT 1 FROM existing_profile)
        RETURNING id, test_get_or_create_test_profile_v4.role::text as role
    ),
    new_profile_name_link AS (
        INSERT INTO profile_names(profile_id, name_id)
        SELECT np.id, COALESCE(nr.id, nl.id)
        FROM new_profile np, name_resource nr FULL OUTER JOIN name_lookup nl ON true
        WHERE NOT EXISTS (SELECT 1 FROM existing_profile)
        RETURNING profile_id
    ),
    new_profile_flag_link AS (
        INSERT INTO profile_flags (profile_id, flag_id, value)
        SELECT np.id, af.id, true
        FROM new_profile np, active_flag af
        WHERE NOT EXISTS (SELECT 1 FROM existing_profile)
        RETURNING profile_id
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
