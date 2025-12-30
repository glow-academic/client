-- Get problem statement for a scenario
-- Parameters: $1=scenario_id (uuid)
-- Returns: problem_statement_id, problem_statement
SELECT 
    ps.id as problem_statement_id,
    ps.problem_statement
FROM scenario_problem_statements sps
JOIN problem_statements ps ON ps.id = sps.problem_statement_id
WHERE sps.scenario_id = $1::uuid
  AND sps.active = true
ORDER BY sps.created_at DESC
LIMIT 1;

