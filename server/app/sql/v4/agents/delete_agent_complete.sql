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
        COALESCE(COALESCE((SELECT n.name FROM profile_names_junction pn JOIN names_resource n ON pn.name_id = n.id WHERE pn.profile_id = p.id LIMIT 1), ''), 'System') as actor_name
    FROM params x
    JOIN profile_artifact p ON p.id = x.profile_id
),
agent_info AS (
    SELECT 
        a.id, 
        (SELECT n.name FROM agent_names_junction an JOIN names_resource n ON an.name_id = n.id WHERE an.agent_id = a.id LIMIT 1) as name
    FROM params x 
    JOIN agents_resource a ON a.id = x.agent_id
),
usage_check AS (
    SELECT COUNT(*) as usage_count
    FROM params x
    JOIN agent_departments_junction ON agent_departments_junction.agent_id = x.agent_id AND agent_departments_junction.active = true
),
delete_result AS (
    DELETE FROM agent_artifact 
    USING params x
    WHERE agent_artifact.id = x.agent_id 
      AND (SELECT usage_count FROM usage_check) = 0
    RETURNING agent_artifact.id
)
SELECT 
    (SELECT usage_count FROM usage_check) as usage_count,
    CASE WHEN EXISTS(SELECT 1 FROM delete_result) THEN true ELSE false END as deleted,
    COALESCE(ai.name, 'Unknown') as name,
    ap.actor_name
FROM actor_profile ap
CROSS JOIN agent_info ai
$$;
