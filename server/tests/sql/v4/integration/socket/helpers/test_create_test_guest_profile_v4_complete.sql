-- Create a test guest profile for socket tests
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
    WITH first_name_resource AS (
        INSERT INTO names_resource(name)
        VALUES ('Guest')
        ON CONFLICT (name) DO NOTHING
        RETURNING id
    ),
    first_name_lookup AS (
        SELECT id FROM names_resource WHERE name = 'Guest' LIMIT 1
    ),
    last_name_resource AS (
        INSERT INTO names_resource(name)
        VALUES ('User')
        ON CONFLICT (name) DO NOTHING
        RETURNING id
    ),
    last_name_lookup AS (
        SELECT id FROM names_resource WHERE name = 'User' LIMIT 1
    ),
    active_flag AS (
        SELECT id FROM flags_resource WHERE name = 'active' LIMIT 1
    ),
    new_profile AS (
        INSERT INTO profiles_resource(role) 
        VALUES ('guest') 
        RETURNING id
    ),
    profile_first_name_link AS (
        INSERT INTO profile_names(profile_id, name_id, type)
        SELECT np.id, COALESCE(fnr.id, fnl.id), 'first'::type_profile_names
        FROM new_profile np, first_name_resource fnr FULL OUTER JOIN first_name_lookup fnl ON true
        RETURNING profile_id
    ),
    profile_last_name_link AS (
        INSERT INTO profile_names(profile_id, name_id, type)
        SELECT np.id, COALESCE(lnr.id, lnl.id), 'last'::type_profile_names
        FROM new_profile np, last_name_resource lnr FULL OUTER JOIN last_name_lookup lnl ON true
        RETURNING profile_id
    ),
    profile_flag_link AS (
        INSERT INTO profile_flags(profile_id, flag_id, type, value)
        SELECT np.id, af.id, 'active'::type_profile_flags, true
        FROM new_profile np, active_flag af
        RETURNING profile_id
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