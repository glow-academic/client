-- Create a test guest profile for socket view_tests_entry
-- Returns guest_id and email
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
    WITH name_resource AS (
        INSERT INTO names_resource(name)
        VALUES ('Guest User')
        ON CONFLICT (name) DO NOTHING
        RETURNING id
    ),
    name_lookup AS (
        SELECT id FROM names_resource WHERE name = 'Guest User' LIMIT 1
    ),
    active_flag AS (
        SELECT id FROM flags_resource WHERE name = 'active' LIMIT 1
    ),
    new_artifact AS (
        INSERT INTO profile_artifact DEFAULT VALUES
        RETURNING id
    ),
    new_profile AS (
        INSERT INTO profiles_resource(id, role)
        SELECT na.id, 'guest'
        FROM new_artifact na
        RETURNING id
    ),
    profile_name_link AS (
        INSERT INTO profile_names_junction(profile_id, name_id)
        SELECT np.id, COALESCE(nr.id, nl.id)
        FROM new_profile np, name_resource nr FULL OUTER JOIN name_lookup nl ON true
        RETURNING profile_id
    ),
    profile_flag_link AS (
        INSERT INTO profile_flags_junction (profile_id, flag_id, value)
        SELECT np.id, af.id, true
        FROM new_profile np, active_flag af
        RETURNING profile_id
    ),
    new_email_resource AS (
        INSERT INTO emails_resource(email)
        SELECT test_create_test_guest_profile_v4.email
        ON CONFLICT (email) DO UPDATE SET email = EXCLUDED.email
        RETURNING id, email
    ),
    new_email AS (
        INSERT INTO profile_emails_junction(profile_id, email_id, email, is_primary, active)
        SELECT np.id, ner.id, test_create_test_guest_profile_v4.email, true, true
        FROM new_profile np, new_email_resource ner
        RETURNING profile_id, email
    )
    SELECT np.id as guest_id, ne.email
    FROM new_profile np
    JOIN new_email ne ON ne.profile_id = np.id;
$$;
