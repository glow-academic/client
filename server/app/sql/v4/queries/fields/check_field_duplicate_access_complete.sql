-- Field Duplicate Access Check
-- Returns user role for Python to compute duplicate permissions

-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_check_field_duplicate_access_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_check_field_duplicate_access_v4(%s)', r.sig);
    END LOOP;
END $$;

-- Create function
CREATE OR REPLACE FUNCTION api_check_field_duplicate_access_v4(
    profile_id uuid
)
RETURNS TABLE (
    -- User context for Python permission logic
    user_role text
)
LANGUAGE sql
STABLE
AS $$
SELECT role::text as user_role
FROM view_user_profile_context
WHERE profile_id = api_check_field_duplicate_access_v4.profile_id;
$$;
