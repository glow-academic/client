-- Get all active tools for an agent
-- Converted to PostgreSQL function
-- Uses safe drop/recreate pattern
-- 1) Drop function first
DROP FUNCTION IF EXISTS socket_get_agent_tools_v4(uuid);

-- 2) Recreate function
CREATE OR REPLACE FUNCTION socket_get_agent_tools_v4(
    agent_id uuid
)
RETURNS TABLE (
    id uuid,
    name text,
    description text,
    tool_type text,
    agent_role text,
    arguments jsonb,
    argument_descriptions jsonb,
    argument_defaults jsonb,
    active boolean
)
LANGUAGE sql
STABLE
AS $$
SELECT DISTINCT ON (t.id)
    t.id,
    t.name,
    t.description,
    COALESCE(rt.resource::text, '') as tool_type,  -- Derive from resource enum
    COALESCE(d.artifact::text, '') as agent_role,  -- Derive from domains
    t.arguments,
    t.argument_descriptions,
    t.argument_defaults,
    t.active
FROM agent_tools at
JOIN tools t ON t.id = at.tool_id
LEFT JOIN resource_tools rt ON rt.tool_id = t.id
LEFT JOIN domains d ON d.agent_id = at.agent_id
WHERE at.agent_id = socket_get_agent_tools_v4.agent_id
  AND at.active = TRUE
  AND t.active = TRUE
ORDER BY t.id, COALESCE(rt.resource::text, ''), t.name
$$;