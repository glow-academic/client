-- Get simulation-scenario link for test verification
-- Returns link data for assertions
-- Drop function if exists
DROP FUNCTION IF EXISTS test_get_simulation_scenario_link_v4(uuid, uuid);

-- Create function
CREATE OR REPLACE FUNCTION test_get_simulation_scenario_link_v4(
    input_simulation_id uuid,
    input_scenario_id uuid
)
RETURNS TABLE (
    simulation_id uuid,
    scenario_id uuid,
    active boolean,
    "position" integer,
    created_at timestamptz
)
LANGUAGE sql
STABLE
AS $$
    SELECT 
        simulation_id,
        scenario_id,
        active,
        "position",
        created_at
    FROM simulation_scenarios
    WHERE simulation_id = test_get_simulation_scenario_link_v4.input_simulation_id
      AND scenario_id = test_get_simulation_scenario_link_v4.input_scenario_id;
$$;