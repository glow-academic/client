-- Hint error handler
-- No-op function (no database operations) - just returns error info
-- Uses safe drop/recreate pattern: drop function first, then types (no CASCADE), then recreate
-- 1) Drop function first (breaks dependency on types)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'socket_hint_error_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS socket_hint_error_v4(%s)', r.sig);
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
        WHERE typname LIKE 'i_hint_error_v4_%'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I', r.typname);
    END LOOP;
END $$;

-- 3) Recreate function
CREATE OR REPLACE FUNCTION socket_hint_error_v4(
    success boolean,
    message text,
    resource_id text DEFAULT NULL,
    group_id text DEFAULT NULL
)
RETURNS TABLE (
    success boolean,
    message text,
    resource_id text,
    group_id text
)
LANGUAGE sql
VOLATILE
AS $$
-- No-op: Just returns error info (no database operations)
SELECT 
    success as success,
    message as message,
    resource_id as resource_id,
    group_id as group_id
$$;

