-- Create a test scenario linked to a parameter item for test setup
-- Returns scenario and link data for assertions
-- Drop function if exists
DROP FUNCTION IF EXISTS test_create_test_scenario_with_parameter_item_v4(uuid);

-- Create function
CREATE OR REPLACE FUNCTION test_create_test_scenario_with_parameter_item_v4(
    input_parameter_item_id uuid
)
RETURNS TABLE (
    scenario_id uuid,
    name text,
    active boolean,
    parameter_item_id uuid,
    link_active boolean,
    created_at timestamptz
)
LANGUAGE sql
VOLATILE
AS $$
    WITH new_scenario AS (
        INSERT INTO scenarios(name, active)
        VALUES ('Test Scenario', true)
        RETURNING id AS scenario_id, name, active, created_at
    ),
    new_link AS (
        INSERT INTO scenario_parameters(scenario_id, parameter_id, active)
        SELECT scenario_id, input_parameter_item_id, true
        FROM new_scenario
        RETURNING scenario_id, parameter_id, active AS link_active
    )
    SELECT 
        ns.scenario_id,
        ns.name,
        ns.active,
        nl.parameter_id AS parameter_item_id,
        nl.link_active,
        ns.created_at
    FROM new_scenario ns
    JOIN new_link nl ON ns.scenario_id = nl.scenario_id;
$$;