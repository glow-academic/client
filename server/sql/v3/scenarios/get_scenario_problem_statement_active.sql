-- Get most recent active problem statement for scenario
-- Parameters: $1=scenario_id (uuid)
-- Returns: problem_statement
SELECT problem_statement
FROM scenario_problem_statements
WHERE scenario_id = $1::uuid AND active = true
ORDER BY created_at DESC, updated_at DESC
LIMIT 1

