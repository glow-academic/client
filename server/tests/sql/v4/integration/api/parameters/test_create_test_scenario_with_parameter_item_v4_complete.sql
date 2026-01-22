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
    WITH name_resource AS (
        INSERT INTO names_resource(name)
        VALUES ('Test Scenario')
        RETURNING id
    ),
    active_flag AS (
        SELECT id FROM flags_resource WHERE name = 'active' LIMIT 1
    ),
    new_scenario AS (
        INSERT INTO scenarios_resource DEFAULT VALUES
        RETURNING id AS scenario_id, created_at
    ),
    scenario_name_link AS (
        INSERT INTO scenario_names_junction(scenario_id, name_id)
        SELECT ns.scenario_id, nr.id
        FROM new_scenario ns, name_resource nr
        RETURNING scenario_id
    ),
    scenario_flag_link AS (
        INSERT INTO scenario_flags_junction (scenario_id, flag_id, value)
        SELECT ns.scenario_id, af.id, true
        FROM new_scenario ns, active_flag af
        RETURNING scenario_id
    ),
    new_link AS (
        INSERT INTO scenario_parameters_junction(scenario_id, parameter_id, active)
        SELECT scenario_id, input_parameter_item_id, true
        FROM new_scenario
        RETURNING scenario_id, parameter_id, active AS link_active
    )
    SELECT 
        ns.scenario_id,
        (SELECT n.name FROM scenario_names_junction sn JOIN names_resource n ON sn.name_id = n.id WHERE sn.scenario_id = ns.scenario_id LIMIT 1) as name,
        EXISTS (SELECT 1 FROM scenario_flags_junction sf JOIN flags_resource fl ON sf.flag_id = fl.id WHERE sf.scenario_id = ns.scenario_id AND fl.name = 'active'  AND sf.value = TRUE) as active,
        nl.parameter_id AS parameter_item_id,
        nl.link_active,
        ns.created_at
    FROM new_scenario ns
    JOIN new_link nl ON ns.scenario_id = nl.scenario_id;
$$;