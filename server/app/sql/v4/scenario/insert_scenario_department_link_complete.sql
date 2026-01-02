-- Insert scenario-department link
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
        WHERE proname = 'api_insert_scenario_department_link_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_insert_scenario_department_link_v4(%s)', r.sig);
    END LOOP;
END $$;

-- Recreate function
CREATE OR REPLACE FUNCTION api_insert_scenario_department_link_v4(
    scenario_id uuid,
    department_id uuid,
    active boolean
)
RETURNS TABLE (
    scenario_id uuid,
    department_id uuid,
    active boolean,
    created_at timestamptz,
    updated_at timestamptz
)
LANGUAGE sql
VOLATILE
AS $$
INSERT INTO scenario_departments (scenario_id, department_id, active, created_at, updated_at)
VALUES (scenario_id, department_id, active, NOW(), NOW())
ON CONFLICT (scenario_id, department_id) DO UPDATE SET
    active = api_insert_scenario_department_link_v4.active,
    updated_at = NOW()
RETURNING *
$$;

COMMIT;

