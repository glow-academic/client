-- Get superadmin profile ID by email (for test setup)
-- Returns profile_id and email for use in tests

BEGIN;

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
        COALESCE(p.first_name || ' ' || p.last_name, 'System') as actor_name
    FROM profile_emails pe
    JOIN profiles p ON p.id = pe.profile_id
    WHERE pe.email = test_get_superadmin_alias_v4.email
      AND pe.active = true
      AND p.role = 'superadmin'::profile_role
    LIMIT 1;
$$;

COMMIT;

