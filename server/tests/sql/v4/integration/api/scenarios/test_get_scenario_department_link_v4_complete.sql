-- Get scenario-department link for test verification
-- Returns link data for assertions

BEGIN;

-- Drop function if exists
DROP FUNCTION IF EXISTS test_get_scenario_department_link_v4(uuid, uuid);

-- Create function
CREATE OR REPLACE FUNCTION test_get_scenario_department_link_v4(
    input_scenario_id uuid,
    input_department_id uuid
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
    WHERE scenario_id = test_get_scenario_department_link_v4.input_scenario_id
      AND department_id = test_get_scenario_department_link_v4.input_department_id;
$$;

COMMIT;

