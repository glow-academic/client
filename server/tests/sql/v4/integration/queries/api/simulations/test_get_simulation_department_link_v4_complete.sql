-- Get simulation-department link for test verification
-- Returns link data for assertions
-- Drop function if exists
DROP FUNCTION IF EXISTS test_get_simulation_department_link_v4(uuid, uuid);

-- Create function
CREATE OR REPLACE FUNCTION test_get_simulation_department_link_v4(
    input_simulation_id uuid,
    input_department_id uuid
)
RETURNS TABLE (
    simulation_id uuid,
    department_id uuid,
    active boolean,
    created_at timestamptz
)
LANGUAGE sql
STABLE
AS $$
    SELECT 
        simulation_id,
        department_id,
        active,
        created_at
    FROM simulation_departments_junction
    WHERE simulation_id = test_get_simulation_department_link_v4.input_simulation_id
      AND department_id = test_get_simulation_department_link_v4.input_department_id;
$$;