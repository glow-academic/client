-- Create a test scenario for socket tests
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
        INSERT INTO scenarios DEFAULT VALUES
        RETURNING id
    ),
    name_resource AS (
        INSERT INTO names(name)
        VALUES (test_create_test_scenario_v4.name)
        RETURNING id
    ),
    active_flag AS (
        SELECT id FROM flags WHERE name = 'active' LIMIT 1
    ),
    scenario_name_link AS (
        INSERT INTO scenario_names(scenario_id, name_id)
        SELECT ns.id, nr.id
        FROM new_scenario ns, name_resource nr
        RETURNING scenario_id
    ),
    scenario_flag_link AS (
        INSERT INTO scenario_flags(scenario_id, flag_id, type, value)
        SELECT ns.id, af.id, 'active'::type_scenario_flags, true
        FROM new_scenario ns, active_flag af
        RETURNING scenario_id
    )
    SELECT ns.id as scenario_id
    FROM new_scenario ns;
$$;