-- Get scenario problem statements (all versions) for test verification
-- Returns all problem statements for a scenario
-- Drop function if exists
DROP FUNCTION IF EXISTS test_get_scenario_problem_statements_v4(uuid);

-- Create function
CREATE OR REPLACE FUNCTION test_get_scenario_problem_statements_v4(
    input_scenario_id uuid
)
RETURNS TABLE (
    scenario_id uuid,
    problem_statement text,
    active boolean,
    created_at timestamptz
)
LANGUAGE sql
STABLE
AS $$
    SELECT 
        scenario_id,
        problem_statement,
        active,
        created_at
    FROM scenario_problem_statements
    WHERE scenario_id = test_get_scenario_problem_statements_v4.input_scenario_id
    ORDER BY created_at DESC;
$$;