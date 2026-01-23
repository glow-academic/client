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
    SELECT (SELECT n.name FROM tool_names_junction tn 
            JOIN names_resource n ON tn.name_id = n.id 
            WHERE tn.tool_id = t.id 
            LIMIT 1) as name
    FROM tool_artifact t
    WHERE t.id = $1
$$;
