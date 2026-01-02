-- Get tools in group_stop for a group (ordered by position_idx)
-- Converted to PostgreSQL function

BEGIN;

-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'api_get_group_stop_tools_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_group_stop_tools_v4(%s)', r.sig);
    END LOOP;
END $$;

-- Recreate function
CREATE OR REPLACE FUNCTION api_get_group_stop_tools_v4(
    group_id uuid
)
RETURNS TABLE (
    tool_id uuid,
    position_idx integer
)
LANGUAGE sql
STABLE
AS $$
SELECT 
    gs.tool_id::uuid,
    gs.position_idx
FROM group_stop gs
WHERE gs.group_id = api_get_group_stop_tools_v4.group_id
ORDER BY gs.position_idx ASC
$$;

COMMIT;

