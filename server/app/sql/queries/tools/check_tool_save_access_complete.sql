-- Tool Save Access Check
-- Returns user role and tool state for Python to compute save permissions

-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_check_tool_save_access_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_check_tool_save_access_v4(%s)', r.sig);
    END LOOP;
END $$;

-- Create function
CREATE OR REPLACE FUNCTION api_check_tool_save_access_v4(
    profile_id uuid,
    tool_id uuid DEFAULT NULL
)
RETURNS TABLE (
    -- Tool state for Python permission logic (0 for create mode)
    active_usage_count bigint
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
-- Get tool active usage count (agents using this tool)
tool_usage_data AS (
    SELECT
        COALESCE(
            (SELECT COUNT(DISTINCT at.agent_id)
             FROM agent_tools_junction at
             JOIN tools_resource tr ON tr.id = at.tools_id
             JOIN tool_tools_junction ttj ON ttj.tool_id = tr.id
             WHERE ttj.tool_id = (SELECT tool_id FROM params)
               AND at.active = true),
            0
        )::bigint as active_usage_count
    FROM params x
    WHERE x.tool_id IS NOT NULL
)
SELECT
    COALESCE((SELECT active_usage_count FROM tool_usage_data), 0)::bigint as active_usage_count
FROM params x
$$;

