-- Update scenario name
-- Converted to PostgreSQL function
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
WITH params AS (
    SELECT 
        api_update_scenario_name_v4.scenario_id AS scenario_id,
        api_update_scenario_name_v4.name AS name
),
scenario_exists_check AS (
    SELECT EXISTS(
        SELECT 1 FROM scenarios WHERE id = (SELECT scenario_id FROM params)
    ) as scenario_exists
),
get_or_create_name AS (
    INSERT INTO names (name, created_at, updated_at)
    SELECT p.name, NOW(), NOW()
    FROM params p
    WHERE p.name IS NOT NULL AND p.name != ''
    ON CONFLICT (name) DO UPDATE SET updated_at = NOW()
    RETURNING id as name_id, name as name_value
),
update_scenario_updated_at AS (
    UPDATE scenarios
    SET updated_at = NOW()
    WHERE id = (SELECT scenario_id FROM params)
      AND EXISTS (SELECT 1 FROM scenario_exists_check WHERE scenario_exists = true)
    RETURNING id
),
delete_old_name_link AS (
    DELETE FROM scenario_names
    WHERE scenario_id = (SELECT scenario_id FROM params)
      AND EXISTS (SELECT 1 FROM scenario_exists_check WHERE scenario_exists = true)
),
link_new_name AS (
    INSERT INTO scenario_names (scenario_id, name_id, created_at, updated_at)
    SELECT p.scenario_id, gocn.name_id, NOW(), NOW()
    FROM params p
    CROSS JOIN get_or_create_name gocn
    WHERE gocn.name_id IS NOT NULL
      AND EXISTS (SELECT 1 FROM scenario_exists_check WHERE scenario_exists = true)
)
SELECT 
    p.scenario_id,
    gocn.name_value
FROM params p
CROSS JOIN get_or_create_name gocn
WHERE EXISTS (SELECT 1 FROM scenario_exists_check WHERE scenario_exists = true)
$$;