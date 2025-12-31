-- Scenario agent eval start handler
-- No-op function (no database operations) - just returns eval info
-- Uses safe drop/recreate pattern: drop function first, then types (no CASCADE), then recreate

BEGIN;

-- 1) Drop function first (breaks dependency on types)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'socket_scenario_eval_start_v3'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS socket_scenario_eval_start_v3(%s)', r.sig);
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
        WHERE typname LIKE 'i_scenario_eval_start_v3_%'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I', r.typname);
    END LOOP;
END $$;

-- 3) Recreate function
CREATE OR REPLACE FUNCTION socket_scenario_eval_start_v3(
    profile_id uuid,
    test_id uuid,
    attempt_id uuid,
    eval_id uuid,
    agent_id uuid,run_id uuid DEFAULT NULL,
    group_id uuid DEFAULT NULL,
    
    use_groups boolean DEFAULT false,
    current_cycle integer DEFAULT 0
)
RETURNS TABLE (
    test_id text,
    attempt_id text,
    eval_id text,
    run_id text,
    group_id text,
    agent_id text,
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
    agent_id::text as agent_id,
    true as success,
    'Scenario eval started' as message
$$;

COMMIT;

