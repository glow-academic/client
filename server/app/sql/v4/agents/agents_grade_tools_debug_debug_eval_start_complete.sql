-- Debug tool eval start handler (grade agent)
-- No-op function (no database operations) - just returns eval info
-- Uses safe drop/recreate pattern: drop function first, then types (no CASCADE), then recreate
-- 1) Drop function first (breaks dependency on types)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'socket_grade_debug_eval_start_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS socket_grade_debug_eval_start_v4(%s)', r.sig);
    END LOOP;
END $$;

-- 2) Drop types WITHOUT CASCADE
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT typname 
        FROM pg_type 
        WHERE typname LIKE 'i_grade_debug_eval_start_v4_%'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I', r.typname);
    END LOOP;
END $$;

-- 3) Recreate function
CREATE OR REPLACE FUNCTION socket_grade_debug_eval_start_v4(
    profile_id uuid,
    test_id uuid,
    attempt_id uuid,
    eval_id uuid,
    tool_id uuid,run_id uuid DEFAULT NULL,
    group_id uuid DEFAULT NULL,
    
    use_groups boolean DEFAULT false
)
RETURNS TABLE (
    test_id text,
    attempt_id text,
    eval_id text,
    run_id text,
    group_id text,
    tool_id text,
    success boolean,
    message text
)
LANGUAGE sql
VOLATILE
AS $$
-- No-op: Just returns eval info (no database operations)
SELECT 
    test_id::text as test_id,
    attempt_id::text as attempt_id,
    eval_id::text as eval_id,
    run_id::text as run_id,
    group_id::text as group_id,
    tool_id::text as tool_id,
    true as success,
    'Debug eval started' as message
$$;