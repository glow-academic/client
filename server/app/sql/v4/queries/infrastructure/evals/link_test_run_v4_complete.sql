-- Link test to run
-- 1) Drop function first
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'infrastructure_evals_link_test_run_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS infrastructure_evals_link_test_run_v4(%s)', r.sig);
    END LOOP;
END $$;

-- 2) Recreate function
-- Links a test to a run by setting the test's group_id to the run's group
CREATE OR REPLACE FUNCTION infrastructure_evals_link_test_run_v4(
    run_id uuid,
    test_id uuid
)
RETURNS void
LANGUAGE sql
VOLATILE
AS $$
    UPDATE tests_entry
    SET group_id = (SELECT group_id FROM runs_entry WHERE id = $1 LIMIT 1),
        updated_at = NOW()
    WHERE id = $2
$$;
