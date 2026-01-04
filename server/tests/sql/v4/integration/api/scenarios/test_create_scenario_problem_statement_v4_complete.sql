-- Create scenario problem statement for test setup
-- Returns problem statement data for verification
-- Drop function if exists
DROP FUNCTION IF EXISTS test_create_scenario_problem_statement_v4(uuid, text);

-- Create function
CREATE OR REPLACE FUNCTION test_create_scenario_problem_statement_v4(
    input_scenario_id uuid,
    input_problem_statement text
)
RETURNS TABLE (
    scenario_id uuid,
    problem_statement text,
    active boolean,
    created_at timestamptz
)
LANGUAGE sql
VOLATILE
AS $$
    INSERT INTO scenario_problem_statements(scenario_id, problem_statement, active)
    VALUES (
        test_create_scenario_problem_statement_v4.input_scenario_id,
        test_create_scenario_problem_statement_v4.input_problem_statement,
        true
    )
    RETURNING scenario_id, problem_statement, active, created_at;
$$;