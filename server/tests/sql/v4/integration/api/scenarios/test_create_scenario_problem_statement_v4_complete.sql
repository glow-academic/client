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
    WITH new_problem_statement AS (
        INSERT INTO problem_statements(name, problem_statement)
        SELECT 'Test Problem Statement', test_create_scenario_problem_statement_v4.input_problem_statement
        RETURNING id, problem_statement, created_at
    ),
    new_link AS (
        INSERT INTO scenario_problem_statements(scenario_id, problem_statement_id, active)
        SELECT test_create_scenario_problem_statement_v4.input_scenario_id, nps.id, true
        FROM new_problem_statement nps
        RETURNING scenario_id, problem_statement_id, active, created_at
    )
    SELECT 
        nl.scenario_id,
        nps.problem_statement,
        nl.active,
        nl.created_at
    FROM new_link nl
    JOIN new_problem_statement nps ON nps.id = nl.problem_statement_id;
$$;