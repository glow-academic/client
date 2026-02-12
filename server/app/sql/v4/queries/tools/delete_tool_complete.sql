-- Delete tool with usage check and name fetch - returns usage_count, name, and deleted (boolean)
-- Converted to function
-- 1) Drop function first (breaks dependency on types)
-- Drop all versions of the function using DO block to handle signature variations
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'api_delete_tool_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_delete_tool_v4(%s)', r.sig);
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION api_delete_tool_v4(
    tool_id uuid,
    profile_id uuid
)
RETURNS TABLE (
    usage_count bigint,
    name text,
    deleted boolean
)
LANGUAGE sql
VOLATILE
AS $$
-- User context (actor_name, user_role, department_ids) comes from get_profile_context_internal() in Python
WITH params AS (
    SELECT tool_id AS tool_id,
           profile_id AS profile_id
),
usage_check AS (
    SELECT COUNT(*)::bigint as usage_count
    FROM params x
    WHERE EXISTS (
        SELECT 1 FROM tool_calls_junction tcj WHERE tcj.tool_id = x.tool_id
        UNION ALL
        SELECT 1 FROM agent_tools_junction at JOIN tools_resource tr ON tr.id = at.tool_id JOIN tool_tools_junction ttj ON ttj.tools_id = tr.id WHERE ttj.tool_id = x.tool_id AND at.active = true
        UNION ALL
        SELECT 1 FROM resource_tools_relation rt WHERE rt.tool_id = x.tool_id
    )
),
tool_info AS (
    SELECT 
        (SELECT n.name FROM tool_names_junction tn JOIN names_resource n ON tn.name_id = n.id WHERE tn.tool_id = t.id LIMIT 1)
    FROM params x
    JOIN tool_artifact t ON t.id = x.tool_id
),
delete_result AS (
    DELETE FROM tool_artifact 
    WHERE id = (SELECT tool_id FROM params)
      AND (SELECT usage_count FROM usage_check) = 0
      AND EXISTS(SELECT 1 FROM tool_info)
    RETURNING id
)
SELECT 
    (SELECT usage_count FROM usage_check) as usage_count,
    (SELECT name FROM tool_info) as name,
    CASE WHEN EXISTS(SELECT 1 FROM delete_result) THEN true ELSE false END as deleted
$$;

