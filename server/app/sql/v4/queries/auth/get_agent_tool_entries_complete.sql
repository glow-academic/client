-- Agent→Tool→Resource resolution for settings-based agent selection
-- Takes agent_ids from settings, returns flat (agent_id, tool_id, resource, is_creatable) rows

-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_get_agent_tool_entries_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_agent_tool_entries_v4(%s)', r.sig);
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION api_get_agent_tool_entries_v4(
    agent_ids uuid[] DEFAULT ARRAY[]::uuid[]
)
RETURNS TABLE (
    agent_id uuid,
    tool_id uuid,
    resource text,
    is_creatable boolean
)
LANGUAGE sql
STABLE
AS $$
-- Resolve: agent_artifact → agent_tools_junction → tools_resource → tool_tools_junction
--        → tool_artifact → resource_tools_relation + flag checks
SELECT
    a.id as agent_id,
    ta.id as tool_id,
    rt.resource::text as resource,
    COALESCE(tf_create.value, true) as is_creatable
FROM agent_artifact a
JOIN agent_tools_junction atj ON atj.agent_id = a.id AND atj.active = true
JOIN tools_resource tr ON tr.id = atj.tool_id
JOIN tool_tools_junction ttj ON ttj.tools_id = tr.id
JOIN tool_artifact ta ON ta.id = ttj.tool_id
JOIN resource_tools_relation rt ON rt.tool_id = ta.id
LEFT JOIN tool_flags_junction tf_active ON tf_active.tool_id = ta.id
LEFT JOIN flags_resource f_active ON f_active.id = tf_active.flag_id AND f_active.name = 'tool_active'
LEFT JOIN tool_flags_junction tf_create ON tf_create.tool_id = ta.id
LEFT JOIN flags_resource f_create ON f_create.id = tf_create.flag_id AND f_create.name = 'tool_creatable'
LEFT JOIN agent_flags_junction af_agent ON af_agent.agent_id = a.id
LEFT JOIN flags_resource f_agent ON f_agent.id = af_agent.flag_id AND f_agent.name = 'agent_active'
WHERE a.id = ANY(agent_ids)
  AND COALESCE(af_agent.value, false) = true
  AND (tf_active.tool_id IS NULL OR COALESCE(f_active.id, NULL) IS NULL OR COALESCE(tf_active.value, false) = true);
$$;
