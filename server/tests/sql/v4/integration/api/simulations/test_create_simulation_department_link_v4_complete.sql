-- Create simulation-department link for test setup
-- Returns link data for verification
-- Drop function if exists
DROP FUNCTION IF EXISTS test_create_simulation_department_link_v4(uuid, uuid);

-- Create function
CREATE OR REPLACE FUNCTION test_create_simulation_department_link_v4(
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
VOLATILE
AS $$
    INSERT INTO simulation_departments(simulation_id, department_id, active)
    VALUES (
        test_create_simulation_department_link_v4.input_simulation_id,
        test_create_simulation_department_link_v4.input_department_id,
        true
    )
    RETURNING simulation_id, department_id, active, created_at;
$$;