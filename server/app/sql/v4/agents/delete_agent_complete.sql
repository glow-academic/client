-- Delete agent with usage check - returns usage_count and deleted (boolean)
-- Converted to function

-- Create function
CREATE OR REPLACE FUNCTION api_delete_agent_v4(
    agent_id uuid,
    profile_id uuid
)
RETURNS TABLE (
    usage_count bigint,
    deleted boolean,
    name text,
    actor_name text
)
LANGUAGE sql
AS $$
WITH params AS (
    SELECT agent_id AS agent_id,
           profile_id AS profile_id
),
actor_profile AS (
    SELECT 
        x.profile_id,
        COALESCE(p.first_name || ' ' || p.last_name, 'System') as actor_name
    FROM params x
    JOIN profiles p ON p.id = x.profile_id
),
agent_info AS (
    SELECT id, name FROM params x JOIN agents ON agents.id = x.agent_id
),
usage_check AS (
    SELECT COUNT(*) as usage_count
    FROM params x
    JOIN agent_departments ON agent_departments.agent_id = x.agent_id AND agent_departments.active = true
),
delete_result AS (
    DELETE FROM agents 
    USING params x
    WHERE agents.id = x.agent_id 
      AND (SELECT usage_count FROM usage_check) = 0
    RETURNING agents.id
)
SELECT 
    (SELECT usage_count FROM usage_check) as usage_count,
    CASE WHEN EXISTS(SELECT 1 FROM delete_result) THEN true ELSE false END as deleted,
    COALESCE(ai.name, 'Unknown') as name,
    ap.actor_name
FROM actor_profile ap
CROSS JOIN agent_info ai
$$;
