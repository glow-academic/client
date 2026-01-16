-- Get benchmark runs start all context
-- Gets eval_id, use_groups, and all pending runs/groups
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
        WHERE proname = 'socket_get_benchmark_runs_start_all_context_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS socket_get_benchmark_runs_start_all_context_v4(%s)', r.sig);
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
        WHERE typname LIKE 'i_get_benchmark_runs_start_all_context_v4_%'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I', r.typname);
    END LOOP;
END $$;

-- 3) Recreate function
CREATE OR REPLACE FUNCTION socket_get_benchmark_runs_start_all_context_v4(
    attempt_id uuid
)
RETURNS TABLE (
    eval_id text,
    use_groups boolean,
    pending_ids text[]
)
LANGUAGE sql
STABLE
AS $$
    SELECT 
        e.id::text as eval_id,
        EXISTS (SELECT 1 FROM eval_flags ef JOIN flags_resource f ON ef.flag_id = f.id WHERE ef.eval_id = e.id AND f.name = 'groups' AND ef.value = TRUE),
        CASE 
            WHEN EXISTS (SELECT 1 FROM eval_flags ef JOIN flags_resource f ON ef.flag_id = f.id WHERE ef.eval_id = e.id AND f.name = 'groups' AND ef.value = TRUE) THEN
                ARRAY_AGG(eg.group_id::text) FILTER (
                    WHERE NOT EXISTS (
                        SELECT 1 FROM grade_groups gg WHERE gg.group_id = eg.group_id
                    )
                )
            ELSE
                ARRAY_AGG(er.run_id::text) FILTER (WHERE er.completed = false)
        END as pending_ids
    FROM eval_attempts ea
    JOIN evals_resource e ON e.id = ea.eval_id
    LEFT JOIN eval_runs er ON er.eval_id = e.id AND er.completed = false
    LEFT JOIN eval_groups eg ON eg.eval_id = e.id
        AND NOT EXISTS (
            SELECT 1 FROM grade_groups gg WHERE gg.group_id = eg.group_id
        )
    WHERE ea.id = socket_get_benchmark_runs_start_all_context_v4.attempt_id
    GROUP BY e.id, EXISTS (SELECT 1 FROM eval_flags ef JOIN flags_resource f ON ef.flag_id = f.id WHERE ef.eval_id = e.id AND f.name = 'groups' AND ef.value = TRUE);
$$;