-- Tool Delete Access Check
-- Returns user role and tool usage for Python to compute delete permissions

-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_check_tool_delete_access_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_check_tool_delete_access_v4(%s)', r.sig);
    END LOOP;
END $$;

-- Create function
CREATE OR REPLACE FUNCTION api_check_tool_delete_access_v4(
    profile_id uuid,
    tool_id uuid
)
RETURNS TABLE (
    -- Tool state for Python permission logic
    usage_count bigint
)
LANGUAGE sql
STABLE
AS $$
-- User context (actor_name, user_role, department_ids) comes from get_profile_context_internal() in Python
WITH params AS (
    SELECT
        profile_id AS profile_id,
        tool_id AS tool_id
),
-- Count total usage from all 3 sources (matching delete mutation SQL)
tool_usage AS (
    SELECT (
        COALESCE((SELECT COUNT(*) FROM tools_calls_connection tcj
            WHERE tcj.tools_id = (SELECT tool_id FROM params)), 0) +
        COALESCE((SELECT COUNT(DISTINCT at.agent_id) FROM agent_tools_junction at
            JOIN tools_resource tr ON tr.id = at.tool_id
            JOIN tool_tools_junction ttj ON ttj.tools_id = tr.id
            WHERE ttj.tool_id = (SELECT tool_id FROM params) AND at.active = true), 0) +
        COALESCE((SELECT COUNT(*) FROM resource_tools_relation rt
            WHERE rt.tool_id = (SELECT tool_id FROM params)), 0)
    )::bigint as usage_count
    FROM params x
)
SELECT
    (SELECT usage_count FROM tool_usage) as usage_count
FROM params x
$$;
