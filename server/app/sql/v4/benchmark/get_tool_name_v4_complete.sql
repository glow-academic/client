-- Get tool name by id
-- 1) Drop function first
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'socket_get_tool_name_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS socket_get_tool_name_v4(%s)', r.sig);
    END LOOP;
END $$;

-- 2) Recreate function
CREATE OR REPLACE FUNCTION socket_get_tool_name_v4(
    tool_id uuid
)
RETURNS TABLE (
    name text
)
LANGUAGE sql
STABLE
AS $$
    SELECT t.name
    FROM tool_artifact t
    WHERE t.id = $1
$$;
