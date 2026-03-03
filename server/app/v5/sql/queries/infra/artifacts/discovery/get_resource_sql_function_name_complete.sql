-- Get SQL function name for creating a resource type
-- Discovers function names matching api_create_{resource_type}_v4 or api_create_{resource_type}s_v4
-- Returns function name if found, NULL otherwise

-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'api_get_resource_sql_function_name_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_resource_sql_function_name_v4(%s)', r.sig);
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION api_get_resource_sql_function_name_v4(
    resource_type text
)
RETURNS TABLE (
    function_name text
)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
    v_function_name text;
BEGIN
    -- First check if resource exists in tool_resources_junction + resources_resource
    IF NOT EXISTS (
        SELECT 1 FROM tool_resources_junction tdj
        JOIN resources_resource dr ON dr.id = tdj.resource_id AND dr.active = true
        WHERE dr.resource = resource_type::resource_type
    ) THEN
        RETURN;  -- Return empty (no rows)
    END IF;
    
    -- Try singular form first
    v_function_name := 'api_create_' || resource_type || '_v4';
    IF EXISTS (
        SELECT 1 FROM pg_proc p
        JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public'
          AND p.proname = v_function_name
    ) THEN
        RETURN QUERY SELECT v_function_name;
        RETURN;
    END IF;
    
    -- Try plural form
    v_function_name := 'api_create_' || resource_type || 's_v4';
    IF EXISTS (
        SELECT 1 FROM pg_proc p
        JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public'
          AND p.proname = v_function_name
    ) THEN
        RETURN QUERY SELECT v_function_name;
        RETURN;
    END IF;
    
    -- Not found - return empty
    RETURN;
END;
$$;
