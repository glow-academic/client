-- Get all department_ids from scenario_departments junction table
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
        WHERE proname = 'api_get_scenario_departments_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_scenario_departments_v4(%s)', r.sig);
    END LOOP;
END $$;

-- Recreate function
CREATE OR REPLACE FUNCTION api_get_scenario_departments_v4(
    scenario_id uuid
)
RETURNS TABLE (
    department_id uuid
)
LANGUAGE sql
STABLE
AS $$
SELECT sd.department_id
FROM scenario_departments sd
WHERE sd.scenario_id = scenario_id 
  AND sd.active = true
$$;

COMMIT;

