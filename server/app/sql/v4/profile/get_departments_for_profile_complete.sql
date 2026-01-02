-- Get departments for a profile
-- Converted to PostgreSQL function

BEGIN;

-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'api_get_departments_for_profile_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_departments_for_profile_v4(%s)', r.sig);
    END LOOP;
END $$;

-- Recreate function
CREATE OR REPLACE FUNCTION api_get_departments_for_profile_v4(
    profile_id uuid
)
RETURNS TABLE (
    id uuid
)
LANGUAGE sql
STABLE
AS $$
SELECT DISTINCT d.id
FROM departments d
JOIN profile_departments pd ON pd.department_id = d.id
WHERE pd.profile_id = profile_id AND d.active = true
$$;

COMMIT;

