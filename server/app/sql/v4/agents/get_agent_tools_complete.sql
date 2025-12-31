-- Get all active tools for an agent
-- Converted to PostgreSQL function
-- Uses safe drop/recreate pattern

BEGIN;

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
WHERE at.agent_id = agent_id
  AND at.active = TRUE
  AND t.active = TRUE
ORDER BY t.tool_type, t.name
$$;

COMMIT;

