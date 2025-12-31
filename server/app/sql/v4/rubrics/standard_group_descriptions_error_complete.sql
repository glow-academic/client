-- Standard group descriptions error event handler
-- No-op function (no database operations) - just returns error info
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
        WHERE proname = 'socket_standard_group_descriptions_error_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS socket_standard_group_descriptions_error_v4(%s)', r.sig);
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
        WHERE typname LIKE 'i_standard_group_descriptions_error_v4_%'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I', r.typname);
    END LOOP;
END $$;

-- 3) Recreate function (no types needed for this simple function)
CREATE OR REPLACE FUNCTION socket_standard_group_descriptions_error_v4(
    success boolean,
    message text,
    profile_id uuid,
    group_id uuid DEFAULT NULL
)
RETURNS TABLE (
    success boolean,
    message text,
    trace_id text
)
LANGUAGE sql
VOLATILE
AS $$
-- No-op: Just returns error info (no database operations)
-- trace_id comes from groups table, not parameter
SELECT 
    success,
    message,
    (SELECT trace_id FROM groups WHERE id = group_id LIMIT 1) as trace_id
$$;

COMMIT;

