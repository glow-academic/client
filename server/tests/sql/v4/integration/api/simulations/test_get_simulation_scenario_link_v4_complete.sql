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
        ss.simulation_id,
        ss.scenario_id,
        EXISTS (SELECT 1 FROM simulation_scenario_flags_resource ssf WHERE ssf.simulation_id = ss.simulation_id AND ssf.scenario_id = ss.scenario_id AND ssf.type = 'active'::type_simulation_scenario_flags AND ssf.value = true) as active,
        COALESCE((SELECT sp.value FROM scenario_positions_resource sp WHERE sp.simulation_id = ss.simulation_id AND sp.scenario_id = ss.scenario_id LIMIT 1), 999999) as "position",
        ss.created_at
    FROM simulation_scenarios ss
    WHERE ss.simulation_id = test_get_simulation_scenario_link_v4.input_simulation_id
      AND ss.scenario_id = test_get_simulation_scenario_link_v4.input_scenario_id;
$$;