-- Get resource type for a tool_id
-- Returns resource_type from resource_tools table

-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'api_get_resource_type_by_tool_id_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_resource_type_by_tool_id_v4(%s)', r.sig);
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION api_get_resource_type_by_tool_id_v4(
    tool_id uuid
)
RETURNS TABLE (
    resource_type text
)
LANGUAGE sql
STABLE
AS $$
    SELECT 
        rt.resource::text as resource_type
    FROM resource_tools rt
    WHERE rt.tool_id = tool_id
    LIMIT 1;
$$;
