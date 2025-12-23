-- Delete agent with usage check - returns usage_count and deleted (boolean)
-- Parameters: $1 = agent_id (uuid), $2 = profile_id (uuid)
-- Returns: usage_count (int), deleted (boolean), name (text), actor_name (text)

WITH actor_profile AS (
    SELECT 
        $2::uuid as profile_id,
        COALESCE(p.first_name || ' ' || p.last_name, 'System') as actor_name
    FROM profiles p
    WHERE p.id = $2::uuid
),
agent_info AS (
    SELECT id, name FROM agents WHERE id = $1::uuid
),
usage_check AS (
    SELECT COUNT(*) as usage_count
    FROM agent_departments
    WHERE agent_id = $1::uuid AND active = true
),
delete_result AS (
    DELETE FROM agents 
    WHERE id = $1::uuid 
      AND (SELECT usage_count FROM usage_check) = 0
    RETURNING id
)
SELECT 
    (SELECT usage_count FROM usage_check) as usage_count,
    CASE WHEN EXISTS(SELECT 1 FROM delete_result) THEN true ELSE false END as deleted,
    COALESCE(ai.name, 'Unknown') as name,
    ap.actor_name
FROM actor_profile ap
CROSS JOIN agent_info ai

