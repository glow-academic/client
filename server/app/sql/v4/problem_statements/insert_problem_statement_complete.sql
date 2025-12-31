-- Insert problem statement (strong entity) and optionally link to scenario
-- Parameters: $1=problem_statement (text), $2=problem_statement_name (text, nullable), $3=scenario_id (uuid, nullable), $4=active (boolean, default true)
WITH create_ps AS (
    INSERT INTO problem_statements (name, problem_statement, created_at, updated_at)
    VALUES (COALESCE($2, 'Problem Statement'), $1, NOW(), NOW())
    RETURNING id as problem_statement_id
),
link_scenario AS (
    -- Optionally link to scenario if scenario_id provided
    INSERT INTO scenario_problem_statements (scenario_id, problem_statement_id, active, created_at, updated_at)
    SELECT $3::uuid, problem_statement_id, COALESCE($4, true), NOW(), NOW()
    FROM create_ps
    WHERE $3 IS NOT NULL
    ON CONFLICT (scenario_id, problem_statement_id) DO UPDATE SET
        active = COALESCE($4, true),
        updated_at = NOW()
)
SELECT problem_statement_id::text as problem_statement_id
FROM create_ps

