-- Check if a tool is in group_stop for a group
-- Converted to PostgreSQL function pattern
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
        WHERE proname = 'socket_check_group_stop_v3'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS socket_check_group_stop_v3(%s)', r.sig);
    END LOOP;
END $$;

-- 2) Recreate function (no types needed for this simple function)
CREATE OR REPLACE FUNCTION socket_check_group_stop_v3(
    group_id uuid,
    tool_id uuid
)
RETURNS TABLE (
    exists boolean
)
LANGUAGE sql
STABLE
AS $$
SELECT EXISTS(
    SELECT 1 
    FROM group_stop 
    WHERE group_stop.group_id = check_group_stop_v3.group_id 
      AND group_stop.tool_id = check_group_stop_v3.tool_id
) as exists
$$;

COMMIT;

