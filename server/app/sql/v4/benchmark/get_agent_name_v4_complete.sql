-- Get agent name by id
-- 1) Drop function first
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'socket_get_agent_name_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS socket_get_agent_name_v4(%s)', r.sig);
    END LOOP;
END $$;

-- 2) Recreate function
CREATE OR REPLACE FUNCTION socket_get_agent_name_v4(
    agent_id uuid
)
RETURNS TABLE (
    name text
)
LANGUAGE sql
STABLE
AS $$
    SELECT (SELECT n.name FROM agent_names an JOIN names_resource n ON an.name_id = n.id WHERE an.agent_id = agents_resource.id LIMIT 1) as name
    FROM agents_resource
    WHERE agents_resource.id = $1
$$;
