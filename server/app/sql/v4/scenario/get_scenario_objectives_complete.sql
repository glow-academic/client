-- Get objectives for a scenario
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
        WHERE proname = 'api_get_scenario_objectives_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_scenario_objectives_v4(%s)', r.sig);
    END LOOP;
END $$;

-- Recreate function
CREATE OR REPLACE FUNCTION api_get_scenario_objectives_v4(
    scenario_id uuid
)
RETURNS TABLE (
    objective_id uuid,
    idx integer
)
LANGUAGE sql
STABLE
AS $$
SELECT 
    so.objective_id,
    so.idx
FROM scenario_objectives so
WHERE so.scenario_id = scenario_id
ORDER BY so.idx
$$;

COMMIT;

