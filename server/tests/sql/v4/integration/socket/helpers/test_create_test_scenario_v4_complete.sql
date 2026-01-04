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
    INSERT INTO scenarios(name, active) 
    VALUES (test_create_test_scenario_v4.name, true) 
    RETURNING id as scenario_id;
$$;