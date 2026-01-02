-- Create eval grade record
-- Converted to PostgreSQL function
-- Note: eval_id removed from grades table - derive from test_runs → tests → attempt_tests → eval_attempts → evals

BEGIN;

-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'api_create_eval_grade_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_create_eval_grade_v4(%s)', r.sig);
    END LOOP;
END $$;

-- Recreate function
CREATE OR REPLACE FUNCTION api_create_eval_grade_v4(
    run_id uuid,
    eval_id uuid,
    description text,
    passed boolean,
    score numeric,
    time_taken numeric,
    rubric_grade_agent_id uuid
)
RETURNS TABLE (
    grade_id text
)
LANGUAGE sql
VOLATILE
AS $$
INSERT INTO grades 
(run_id, rubric_grade_agent_id, description, passed, score, time_taken, created_at)
SELECT 
    run_id,
    rubric_grade_agent_id,
    description,
    passed,
    score,
    time_taken,
    NOW()
WHERE (eval_id IS NOT NULL OR eval_id IS NULL)  -- Use eval_id to help PostgreSQL infer type
RETURNING id::text as grade_id
$$;

COMMIT;

