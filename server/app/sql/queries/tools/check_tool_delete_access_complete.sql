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
    active_agent_count bigint
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
-- Count active agent links (immediate parent only)
agent_links AS (
    SELECT COALESCE(COUNT(DISTINCT atj.agent_id), 0)::bigint as active_count
    FROM params x
    LEFT JOIN tool_tools_junction ttj ON ttj.tool_id = x.tool_id
    LEFT JOIN agent_tools_junction atj ON atj.tool_id = ttj.tool_id AND atj.active = true
)
SELECT
    (SELECT active_count FROM agent_links) as active_agent_count
FROM params x
$$;
