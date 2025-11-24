-- Insert problem statement and link to scenario
-- Parameters: $1=scenario_id, $2=problem_statement (text), $3=problem_statement_name (text, nullable), $4=active
WITH create_ps AS (
    INSERT INTO problem_statements (name, problem_statement, created_at, updated_at)
    VALUES ($3, $2, NOW(), NOW())
    RETURNING id as problem_statement_id
)
INSERT INTO scenario_problem_statements (scenario_id, problem_statement_id, active, created_at, updated_at)
SELECT $1::uuid, problem_statement_id, $4, NOW(), NOW()
FROM create_ps
RETURNING *

