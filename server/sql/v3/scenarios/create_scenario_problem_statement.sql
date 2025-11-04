INSERT INTO scenario_problem_statements (scenario_id, problem_statement, active, created_at, updated_at)
VALUES ($1::uuid, $2, true, NOW(), NOW())
RETURNING id

