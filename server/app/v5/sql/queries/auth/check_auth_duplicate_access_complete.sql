-- Auth Duplicate Access Check
-- Checks if auth exists for duplicate operation
-- User role comes from get_profile_context_internal() in Python

-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_check_auth_duplicate_access_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_check_auth_duplicate_access_v4(%s)', r.sig);
    END LOOP;
END $$;

-- Create function
CREATE OR REPLACE FUNCTION api_check_auth_duplicate_access_v4(
    profile_id uuid,
    auth_id uuid
)
RETURNS TABLE (
    auth_exists boolean
)
LANGUAGE sql
STABLE
AS $$
WITH params AS (
    SELECT profile_id AS profile_id, auth_id AS auth_id
),
auth_exists_check AS (
    SELECT EXISTS(
        SELECT 1 FROM auths_resource WHERE id = (SELECT auth_id FROM params)
    )::boolean as auth_exists
)
SELECT (SELECT auth_exists FROM auth_exists_check) as auth_exists
FROM params x
$$;
