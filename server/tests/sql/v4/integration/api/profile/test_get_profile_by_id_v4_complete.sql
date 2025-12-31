-- Get profile by ID for test verification
-- Returns profile details for assertions

BEGIN;

-- Drop function if exists
DROP FUNCTION IF EXISTS test_get_profile_by_id_v4(uuid);

-- Create function
CREATE OR REPLACE FUNCTION test_get_profile_by_id_v4(
    input_profile_id uuid
)
RETURNS TABLE (
    profile_id uuid,
    first_name text,
    last_name text,
    role text,
    active boolean,
    default_profile boolean,
    req_per_day integer,
    last_login timestamptz,
    last_active timestamptz,
    created_at timestamptz,
    updated_at timestamptz
)
LANGUAGE sql
STABLE
AS $$
    SELECT 
        id AS profile_id,
        first_name,
        last_name,
        role,
        active,
        default_profile,
        req_per_day,
        last_login,
        last_active,
        created_at,
        updated_at
    FROM profiles
    WHERE id = input_profile_id;
$$;

COMMIT;

