-- Get images for a scenario
-- Converted to PostgreSQL function
-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'api_get_scenario_images_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_scenario_images_v4(%s)', r.sig);
    END LOOP;
END $$;

-- Recreate function
CREATE OR REPLACE FUNCTION api_get_scenario_images_v4(
    scenario_id uuid
)
RETURNS TABLE (
    image_id uuid,
    active boolean
)
LANGUAGE sql
STABLE
AS $$
SELECT 
    si.image_id,
    si.active
FROM scenario_images si
WHERE si.scenario_id = scenario_id
  AND si.active = true
$$;