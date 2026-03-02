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
-- Input agent_ids are agents_resource IDs (resolved through settings -> systems -> agents).
-- Bridge: agents_resource → agent_agents_junction → agent_artifact to traverse tool chain.
-- Return the original agents_resource ID as agent_id (downstream expects resource IDs).
SELECT
    aaj.agents_id as agent_id,
    ta.id as tool_id,
    dr.resource::text as resource,
    COALESCE(tr.operation = 'create', false) as is_creatable
FROM agent_agents_junction aaj
JOIN agent_artifact a ON a.id = aaj.agent_id
JOIN agent_tools_junction atj ON atj.agent_id = a.id AND atj.active = true
JOIN tools_resource tr ON tr.id = atj.tool_id
JOIN tool_tools_junction ttj ON ttj.tools_id = tr.id
JOIN tool_artifact ta ON ta.id = ttj.tool_id
JOIN tool_resources_junction tdj ON tdj.tool_id = ta.id AND tdj.active = true
JOIN resources_resource dr ON dr.id = tdj.resource_id AND dr.active = true
LEFT JOIN tool_flags_junction tf_active ON tf_active.tool_id = ta.id
LEFT JOIN flags_resource f_active ON f_active.id = tf_active.flag_id AND f_active.name = 'tool_active'
LEFT JOIN agent_flags_junction af_agent ON af_agent.agent_id = a.id
LEFT JOIN flags_resource f_agent ON f_agent.id = af_agent.flag_id AND f_agent.name = 'agent_active'
WHERE aaj.agents_id = ANY(agent_ids)
  AND COALESCE(af_agent.value, false) = true
  AND (tf_active.tool_id IS NULL OR COALESCE(f_active.id, NULL) IS NULL OR COALESCE(tf_active.value, false) = true);
$$;
