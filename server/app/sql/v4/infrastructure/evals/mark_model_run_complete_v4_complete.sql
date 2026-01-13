-- Mark eval_model_run as complete
-- 1) Drop function first
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'infrastructure_evals_mark_model_run_complete_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS infrastructure_evals_mark_model_run_complete_v4(%s)', r.sig);
    END LOOP;
END $$;

-- 2) Recreate function
CREATE OR REPLACE FUNCTION infrastructure_evals_mark_model_run_complete_v4(
    eval_id uuid,
    model_run_id uuid
)
RETURNS void
LANGUAGE sql
VOLATILE
AS $$
    UPDATE eval_runs 
    SET completed = true, updated_at = NOW()
    WHERE eval_runs.eval_id = $1 AND eval_runs.run_id = $2
$$;
