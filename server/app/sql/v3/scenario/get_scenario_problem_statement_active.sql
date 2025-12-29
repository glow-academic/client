-- Get most recent active problem statement for scenario
-- Parameters: $1=scenario_id (uuid)
-- Returns: problem_statement
SELECT ps.problem_statement
FROM scenario_problem_statements sps_j
JOIN problem_statements ps ON ps.id = sps_j.problem_statement_id
WHERE sps_j.scenario_id = $1::uuid AND sps_j.active = true
ORDER BY sps_j.created_at DESC, sps_j.updated_at DESC
LIMIT 1

