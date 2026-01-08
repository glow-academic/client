-- Get benchmark run start context
-- Gets eval_id, use_groups, and verifies run belongs to attempt's eval
-- Uses safe drop/recreate pattern: drop function first, then types (no CASCADE), then recreate
-- 1) Drop function first (breaks dependency on types)
-- Drop all versions of the function using DO block to handle signature variations
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'socket_get_benchmark_run_start_context_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS socket_get_benchmark_run_start_context_v4(%s)', r.sig);
    END LOOP;
END $$;

-- 2) Drop types WITHOUT CASCADE
-- Drop all types matching prefix pattern to handle type additions/removals
-- If any other object depends on them, this will ERROR and stop the migration (good)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT typname 
        FROM pg_type 
        WHERE typname LIKE 'i_get_benchmark_run_start_context_v4_%'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I', r.typname);
    END LOOP;
END $$;

-- 3) Recreate function
CREATE OR REPLACE FUNCTION socket_get_benchmark_run_start_context_v4(
    attempt_id uuid,
    run_id uuid
)
RETURNS TABLE (
    eval_id text,
    use_groups boolean,
    run_id uuid,
    run_completed boolean
)
LANGUAGE sql
STABLE
AS $$
    SELECT 
        e.id::text as eval_id,
        EXISTS (SELECT 1 FROM eval_flags ef JOIN flags fl ON ef.flag_id = fl.id WHERE ef.eval_id = e.id AND fl.name = 'groups' AND ef.type = 'groups'::type_eval_flags AND ef.value = TRUE),
        er.run_id::uuid as run_id,
        er.completed as run_completed
    FROM eval_attempts ea
    JOIN evals e ON e.id = ea.eval_id
    LEFT JOIN eval_runs er ON er.eval_id = e.id AND er.run_id = socket_get_benchmark_run_start_context_v4.run_id
    WHERE ea.id = socket_get_benchmark_run_start_context_v4.attempt_id;
$$;