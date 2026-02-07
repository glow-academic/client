-- Provider duplicate access check
-- Returns only user_role for Python permission logic
-- Parameters: (profile_id)

-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_check_provider_duplicate_access_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_check_provider_duplicate_access_v4(%s)', r.sig);
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION api_check_provider_duplicate_access_v4(
    profile_id uuid
)
RETURNS TABLE (
    user_role text
)
LANGUAGE sql
STABLE
AS $$
SELECT role::text as user_role
FROM view_user_profile_context
WHERE profile_id = api_check_provider_duplicate_access_v4.profile_id;
$$;
