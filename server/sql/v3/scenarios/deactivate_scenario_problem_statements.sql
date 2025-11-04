UPDATE scenario_problem_statements
SET active = false, updated_at = NOW()
WHERE scenario_id = $1::uuid AND active = true

