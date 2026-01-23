-- Get test status (id and completed) by trace_id and attempt_id
-- 1) Drop function first
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'infrastructure_evals_get_test_status_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS infrastructure_evals_get_test_status_v4(%s)', r.sig);
    END LOOP;
END $$;

-- 2) Recreate function
CREATE OR REPLACE FUNCTION infrastructure_evals_get_test_status_v4(
    attempt_id uuid,
    trace_id text
)
RETURNS TABLE (
    test_id text,
    completed boolean
)
LANGUAGE sql
STABLE
AS $$
    SELECT t.id::text as test_id, t.completed
    FROM tests_entry t
    WHERE t.attempt_id = $1
      AND t.trace_id = $2
      AND t.completed = false
    LIMIT 1
$$;
