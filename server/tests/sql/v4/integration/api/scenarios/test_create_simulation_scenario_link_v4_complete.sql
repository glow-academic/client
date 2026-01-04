-- Create simulation-scenario link for test setup
-- Returns link data for verification

BEGIN;

-- Drop function if exists
DROP FUNCTION IF EXISTS test_create_simulation_scenario_link_v4(uuid, uuid, integer);

-- Create function
CREATE OR REPLACE FUNCTION test_create_simulation_scenario_link_v4(
    input_simulation_id uuid,
    input_scenario_id uuid,
    input_position integer DEFAULT 1
)
RETURNS TABLE (
    simulation_id uuid,
    scenario_id uuid,
    active boolean,
    position integer,
    created_at timestamptz
)
LANGUAGE sql
VOLATILE
AS $$
    INSERT INTO simulation_scenarios(simulation_id, scenario_id, active, position)
    VALUES (
        test_create_simulation_scenario_link_v4.input_simulation_id,
        test_create_simulation_scenario_link_v4.input_scenario_id,
        true,
        COALESCE(test_create_simulation_scenario_link_v4.input_position, 1)
    )
    RETURNING simulation_id, scenario_id, active, position, created_at;
$$;

COMMIT;

