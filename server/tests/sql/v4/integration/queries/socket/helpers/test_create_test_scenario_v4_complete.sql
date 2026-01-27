-- Create a test scenario for socket view_tests_entry
-- Returns scenario_id
-- Drop function if exists
DROP FUNCTION IF EXISTS test_create_test_scenario_v4(text);

-- Create function
CREATE OR REPLACE FUNCTION test_create_test_scenario_v4(
    name text DEFAULT 'Test Scenario'
)
RETURNS TABLE (
    scenario_id uuid
)
LANGUAGE sql
VOLATILE
AS $$
    WITH new_scenario AS (
        INSERT INTO scenarios_resource DEFAULT VALUES
        RETURNING id
    ),
    name_resource AS (
        INSERT INTO names_resource(name)
        VALUES (test_create_test_scenario_v4.name)
        RETURNING id
    ),
    active_flag AS (
        SELECT id FROM flags_resource WHERE name = 'active' LIMIT 1
    ),
    scenario_name_link AS (
        INSERT INTO scenario_names_junction(scenario_id, name_id)
        SELECT ns.id, nr.id
        FROM new_scenario ns, name_resource nr
        RETURNING scenario_id
    ),
    scenario_flag_link AS (
        INSERT INTO scenario_flags_junction (scenario_id, flag_id, value)
        SELECT ns.id, af.id, true
        FROM new_scenario ns, active_flag af
        RETURNING scenario_id
    )
    SELECT ns.id as scenario_id
    FROM new_scenario ns;
$$;