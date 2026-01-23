-- Mark eval_run as completed
-- 1) Drop function first
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'infrastructure_evals_mark_eval_run_complete_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS infrastructure_evals_mark_eval_run_complete_v4(%s)', r.sig);
    END LOOP;
END $$;

-- 2) Recreate function
CREATE OR REPLACE FUNCTION infrastructure_evals_mark_eval_run_complete_v4(
    eval_id uuid,
    run_id uuid
)
RETURNS void
LANGUAGE sql
VOLATILE
AS $$
    UPDATE eval_runs_junction SET completed = true
    WHERE eval_runs_junction.eval_id = $1 AND eval_runs_junction.run_id = $2
$$;
