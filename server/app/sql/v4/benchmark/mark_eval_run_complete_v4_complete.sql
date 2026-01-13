-- Mark eval_run as completed
-- 1) Drop function first
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'socket_mark_eval_run_complete_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS socket_mark_eval_run_complete_v4(%s)', r.sig);
    END LOOP;
END $$;

-- 2) Recreate function
CREATE OR REPLACE FUNCTION socket_mark_eval_run_complete_v4(
    eval_id uuid,
    run_id uuid
)
RETURNS void
LANGUAGE sql
VOLATILE
AS $$
    UPDATE eval_runs SET completed = true, updated_at = NOW()
    WHERE eval_runs.eval_id = $1 AND eval_runs.run_id = $2
$$;
