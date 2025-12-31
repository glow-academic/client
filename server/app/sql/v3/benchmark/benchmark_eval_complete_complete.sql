-- Benchmark eval completion event handler
-- No-op function (no database operations) - just returns completion info
-- Uses safe drop/recreate pattern: drop function first, then types (no CASCADE), then recreate

BEGIN;

-- 1) Drop function first (breaks dependency on types)
-- Drop all versions of the function using DO block to handle signature variations
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'socket_benchmark_eval_complete_v3'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS socket_benchmark_eval_complete_v3(%s)', r.sig);
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
        WHERE typname LIKE 'i_benchmark_eval_complete_v3_%'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I', r.typname);
    END LOOP;
END $$;

-- 3) Recreate function
CREATE OR REPLACE FUNCTION socket_benchmark_eval_complete_v3(
    profile_id uuid,
    test_id uuid,
    attempt_id uuid,
    eval_id uuid,
    success boolean,
    run_id uuid DEFAULT NULL,
    group_id uuid DEFAULT NULL,
    agent_id uuid DEFAULT NULL,
    tool_id uuid DEFAULT NULL,
    message text DEFAULT NULL
)
RETURNS TABLE (
    test_id text,
    attempt_id text,
    eval_id text,
    run_id text,
    group_id text,
    agent_id text,
    tool_id text,
    success boolean,
    message text,
    trace_id text
)
LANGUAGE sql
VOLATILE
AS $$
-- No-op: Just returns completion info (no database operations)
-- trace_id comes from groups table, not parameter
SELECT 
    test_id::text as test_id,
    attempt_id::text as attempt_id,
    eval_id::text as eval_id,
    run_id::text as run_id,
    group_id::text as group_id,
    agent_id::text as agent_id,
    tool_id::text as tool_id,
    success,
    message,
    (SELECT trace_id FROM groups WHERE id = group_id LIMIT 1) as trace_id
$$;

COMMIT;

