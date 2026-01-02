-- Update scenario name
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
        WHERE proname = 'api_update_scenario_name_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_update_scenario_name_v4(%s)', r.sig);
    END LOOP;
END $$;

-- Recreate function
CREATE OR REPLACE FUNCTION api_update_scenario_name_v4(
    scenario_id uuid,
    name text
)
RETURNS TABLE (
    scenario_id uuid,
    name text
)
LANGUAGE sql
VOLATILE
AS $$
UPDATE scenarios
SET name = api_update_scenario_name_v4.name,
    updated_at = NOW()
WHERE id = scenario_id
RETURNING id as scenario_id, name
$$;

COMMIT;

