INSERT INTO scenario_problem_statements (scenario_id, problem_statement, active)
VALUES ($1, $2, $3)
RETURNING *

