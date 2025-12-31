-- Get all active tools for an agent
-- Parameters: $1=agent_id (uuid)
SELECT 
    t.id,
    t.name,
    t.description,
    t.tool_type,
    t.agent_role,
    t.arguments,
    t.argument_descriptions,
    t.argument_defaults,
    t.active
FROM agent_tools at
JOIN tools t ON t.id = at.tool_id
WHERE at.agent_id = $1::uuid
  AND at.active = TRUE
  AND t.active = TRUE
ORDER BY t.tool_type, t.name

