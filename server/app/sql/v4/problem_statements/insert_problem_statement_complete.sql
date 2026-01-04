DROP FUNCTION IF EXISTS api_insert_problem_statement_v4(text, text, uuid, boolean);
CREATE OR REPLACE FUNCTION api_insert_problem_statement_v4(
    problem_statement text,
    problem_statement_name text,
    scenario_id uuid,
    active boolean
)
RETURNS TABLE (
    problem_statement_id text
)
LANGUAGE sql
AS $$
WITH create_ps AS (
    INSERT INTO problem_statements (name, problem_statement, created_at, updated_at)
    VALUES (COALESCE(api_insert_problem_statement_v4.problem_statement_name, 'Problem Statement'), api_insert_problem_statement_v4.problem_statement, NOW(), NOW())
    RETURNING id as problem_statement_id
),
link_scenario AS (
    -- Optionally link to scenario if scenario_id provided
    INSERT INTO scenario_problem_statements (scenario_id, problem_statement_id, active, created_at, updated_at)
    SELECT api_insert_problem_statement_v4.scenario_id, problem_statement_id, COALESCE(api_insert_problem_statement_v4.active, true), NOW(), NOW()
    FROM create_ps
    WHERE api_insert_problem_statement_v4.scenario_id IS NOT NULL
    ON CONFLICT (scenario_id, problem_statement_id) DO UPDATE SET
        active = COALESCE(api_insert_problem_statement_v4.active, true),
        updated_at = NOW()
)
SELECT problem_statement_id::text as problem_statement_id
FROM create_ps
$$;