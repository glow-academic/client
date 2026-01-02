-- Get attempt with active profile in single query
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
        WHERE proname = 'api_get_attempt_with_profile_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_attempt_with_profile_v4(%s)', r.sig);
    END LOOP;
END $$;

-- Recreate function
CREATE OR REPLACE FUNCTION api_get_attempt_with_profile_v4(
    attempt_id uuid
)
RETURNS TABLE (
    id uuid,
    simulation_id uuid,
    created_at timestamptz,
    infinite_mode boolean,
    profile_id uuid
)
LANGUAGE sql
STABLE
AS $$
SELECT 
    sa.id,
    sa.simulation_id,
    sa.created_at,
    sa.infinite_mode,
    (SELECT profile_id FROM attempt_profiles WHERE attempt_id = sa.id AND active = true LIMIT 1) as profile_id
FROM simulation_attempts sa
WHERE sa.id = attempt_id
$$;

COMMIT;

