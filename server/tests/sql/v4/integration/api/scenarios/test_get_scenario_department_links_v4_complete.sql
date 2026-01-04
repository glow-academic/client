-- Get all scenario-department links for test verification
-- Returns all links for a scenario

BEGIN;

-- Drop function if exists
DROP FUNCTION IF EXISTS test_get_scenario_department_links_v4(uuid);

-- Create function
CREATE OR REPLACE FUNCTION test_get_scenario_department_links_v4(
    input_scenario_id uuid
)
RETURNS TABLE (
    scenario_id uuid,
    department_id uuid,
    active boolean,
    created_at timestamptz
)
LANGUAGE sql
STABLE
AS $$
    SELECT 
        scenario_id,
        department_id,
        active,
        created_at
    FROM scenario_departments
    WHERE scenario_id = test_get_scenario_department_links_v4.input_scenario_id;
$$;

COMMIT;

