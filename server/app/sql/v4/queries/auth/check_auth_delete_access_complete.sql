-- Auth Delete Access Check
-- Returns user role for Python to compute delete permissions

-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_check_auth_delete_access_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_check_auth_delete_access_v4(%s)', r.sig);
    END LOOP;
END $$;

-- Create function
CREATE OR REPLACE FUNCTION api_check_auth_delete_access_v4(
    profile_id uuid,
    auth_id uuid
)
RETURNS TABLE (
    -- User context for Python permission logic
    user_role text,
    auth_exists boolean
)
LANGUAGE sql
STABLE
AS $$
WITH params AS (
    SELECT
        profile_id AS profile_id,
        auth_id AS auth_id
),
-- Get user profile info
user_profile AS (
    SELECT role
    FROM view_user_profile_context
    WHERE profile_id = (SELECT profile_id FROM params)
),
-- Check if auth exists
auth_exists_check AS (
    SELECT EXISTS(SELECT 1 FROM auths_resource WHERE id = (SELECT auth_id FROM params))::boolean as auth_exists
)
SELECT
    up.role::text as user_role,
    (SELECT auth_exists FROM auth_exists_check) as auth_exists
FROM params x
CROSS JOIN user_profile up;
$$;
