-- Create a test profile for test setup
-- Returns profile data for assertions

BEGIN;

-- Drop function if exists
DROP FUNCTION IF EXISTS test_create_test_profile_v4(text, text, text, boolean, boolean);

-- Create function
CREATE OR REPLACE FUNCTION test_create_test_profile_v4(
    profile_first_name text,
    profile_last_name text,
    profile_role text,
    profile_active boolean DEFAULT true,
    profile_default_profile boolean DEFAULT false
)
RETURNS TABLE (
    profile_id uuid,
    first_name text,
    last_name text,
    role text,
    active boolean,
    default_profile boolean,
    created_at timestamptz,
    updated_at timestamptz
)
LANGUAGE sql
VOLATILE
AS $$
    INSERT INTO profiles(first_name, last_name, role, active, default_profile)
    VALUES (
        profile_first_name,
        profile_last_name,
        profile_role,
        profile_active,
        profile_default_profile
    )
    RETURNING id AS profile_id, first_name, last_name, role, active, default_profile, created_at, updated_at;
$$;

COMMIT;

