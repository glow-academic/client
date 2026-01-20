-- Get superadmin profile ID by email (for test setup)
-- Returns profile_id and email for use in tests
-- Drop function if exists
DROP FUNCTION IF EXISTS test_get_superadmin_alias_v4(text);

-- Create function
CREATE OR REPLACE FUNCTION test_get_superadmin_alias_v4(
    email text DEFAULT 'redacted@purdue.edu'
)
RETURNS TABLE (
    profile_id uuid,
    email text,
    actor_name text
)
LANGUAGE sql
STABLE
AS $$
    SELECT 
        pe.profile_id,
        pe.email,
        COALESCE(
            (SELECT n.name FROM profile_names pn JOIN names_resource n ON pn.name_id = n.id WHERE pn.profile_id = p.id LIMIT 1),
            'System'
        ) as actor_name
    FROM profile_emails pe
    JOIN profiles_resource p ON p.id = pe.profile_id
    WHERE pe.email = test_get_superadmin_alias_v4.email
      AND pe.active = true
      AND p.role = 'superadmin'::profile_role
    LIMIT 1;
$$;
