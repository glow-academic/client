INSERT INTO scenario_problem_statements (scenario_id, problem_statement, active)
SELECT $1, problem_statement, active
FROM scenario_problem_statements
WHERE scenario_id = $2

