-- Get session by profile ID
-- Simple data fetching for profile context 2-pass architecture
-- Parameters: p_profile_id (uuid)
-- Returns: session_id (uuid)

-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_get_session_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_session_v4(%s)', r.sig);
    END LOOP;
END $$;

-- Create function
CREATE OR REPLACE FUNCTION api_get_session_v4(
    p_profile_id uuid DEFAULT NULL
)
RETURNS TABLE (
    session_id uuid
)
LANGUAGE sql
STABLE
AS $$
SELECT session_id
FROM sessions_mv
WHERE profile_id = p_profile_id
  AND active = true
ORDER BY session_created_at DESC
LIMIT 1;
$$;
