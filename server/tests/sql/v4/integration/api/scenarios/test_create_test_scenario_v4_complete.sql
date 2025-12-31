-- Create a test scenario for test setup
-- Returns scenario_id for use in tests

BEGIN;

-- Drop function if exists
DROP FUNCTION IF EXISTS test_create_test_scenario_v4(text, text);

-- Create function
CREATE OR REPLACE FUNCTION test_create_test_scenario_v4(
    scenario_name text DEFAULT 'Test Scenario',
    scenario_problem_statement text DEFAULT 'Test problem statement'
)
RETURNS TABLE (
    scenario_id uuid,
    name text,
    problem_statement text,
    active boolean,
    created_at timestamptz
)
LANGUAGE plpgsql
VOLATILE
AS $$
DECLARE
    v_scenario_id uuid;
BEGIN
    -- Insert scenario
    INSERT INTO scenarios(name, active)
    VALUES (
        COALESCE(test_create_test_scenario_v4.scenario_name, 'Test Scenario'),
        true
    )
    RETURNING id INTO v_scenario_id;

    -- Insert self-referencing tree edge
    INSERT INTO scenario_tree(parent_id, child_id, active)
    VALUES (v_scenario_id, v_scenario_id, true);

    -- Insert problem statement
    INSERT INTO scenario_problem_statements(scenario_id, problem_statement, active)
    VALUES (
        v_scenario_id,
        COALESCE(test_create_test_scenario_v4.scenario_problem_statement, 'Test problem statement'),
        true
    );

    -- Return result
    RETURN QUERY
    SELECT 
        s.id as scenario_id,
        s.name,
        sps.problem_statement,
        s.active,
        s.created_at
    FROM scenarios s
    JOIN scenario_problem_statements sps ON sps.scenario_id = s.id AND sps.active = true
    WHERE s.id = v_scenario_id;
END;
$$;

COMMIT;

