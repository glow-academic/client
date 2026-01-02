-- Get simulation's scenarios with position ordering
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
        WHERE proname = 'api_get_simulation_scenarios_ordered_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_simulation_scenarios_ordered_v4(%s)', r.sig);
    END LOOP;
END $$;

-- Recreate function
CREATE OR REPLACE FUNCTION api_get_simulation_scenarios_ordered_v4(
    simulation_id uuid
)
RETURNS TABLE (
    scenario_id uuid,
    position_val integer
)
LANGUAGE sql
STABLE
AS $$
SELECT ss.scenario_id, ss.position as position_val
FROM simulation_scenarios ss
WHERE ss.simulation_id = api_get_simulation_scenarios_ordered_v4.simulation_id
ORDER BY ss.position
$$;

COMMIT;

