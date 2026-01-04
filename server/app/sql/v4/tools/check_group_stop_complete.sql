-- Check if a tool is in group_stop for a group
-- Converted to PostgreSQL function pattern
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
        WHERE proname = 'socket_check_group_stop_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS socket_check_group_stop_v4(%s)', r.sig);
    END LOOP;
END $$;

-- 2) Recreate function (no types needed for this simple function)
CREATE OR REPLACE FUNCTION socket_check_group_stop_v4(
    group_id uuid,
    tool_id uuid
)
RETURNS TABLE (
    "exists" boolean
)
LANGUAGE sql
STABLE
AS $$
WITH params AS (
    SELECT group_id, tool_id
)
SELECT EXISTS(
    SELECT 1 
    FROM group_stop gs
    CROSS JOIN params p
    WHERE gs.group_id = p.group_id 
      AND gs.tool_id = p.tool_id
) as "exists"
$$;