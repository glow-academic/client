-- Get problem statement for a scenario
-- Converted to PostgreSQL function

BEGIN;

-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'api_get_scenario_problem_statement_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_scenario_problem_statement_v4(%s)', r.sig);
    END LOOP;
END $$;

-- Recreate function
CREATE OR REPLACE FUNCTION api_get_scenario_problem_statement_v4(
    scenario_id uuid
)
RETURNS TABLE (
    problem_statement_id uuid,
    problem_statement text
)
LANGUAGE sql
STABLE
AS $$
SELECT 
    ps.id as problem_statement_id,
    ps.problem_statement
FROM scenario_problem_statements sps
JOIN problem_statements ps ON ps.id = sps.problem_statement_id
WHERE sps.scenario_id = scenario_id
  AND sps.active = true
ORDER BY sps.created_at DESC
LIMIT 1
$$;

COMMIT;

