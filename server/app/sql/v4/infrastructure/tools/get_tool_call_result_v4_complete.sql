-- Get tool call result JSON
-- 1) Drop function first
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'infrastructure_tools_get_tool_call_result_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS infrastructure_tools_get_tool_call_result_v4(%s)', r.sig);
    END LOOP;
END $$;

-- 2) Recreate function
CREATE OR REPLACE FUNCTION infrastructure_tools_get_tool_call_result_v4(
    tool_call_id uuid
)
RETURNS TABLE (
    result_json jsonb
)
LANGUAGE sql
STABLE
AS $$
    SELECT result_json
    FROM tool_call_results
    WHERE tool_call_results.tool_call_id = $1
    ORDER BY created_at DESC
    LIMIT 1
$$;
