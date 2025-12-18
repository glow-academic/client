-- Update eval attempt settings
-- Parameters: 
--   $1 = attempt_id (uuid)
--   $2 = conversation_mode (boolean, nullable)
--   $3 = conversation_agent_id (uuid, nullable)
--   $4 = conversation_max_turns (integer, nullable)
-- Returns: attempt_id, actor_name

WITH updated_attempt AS (
    UPDATE eval_attempts
    SET 
        conversation_mode = COALESCE($2::bool, conversation_mode),
        conversation_agent_id = CASE WHEN $3::uuid IS NULL THEN conversation_agent_id ELSE $3::uuid END,
        conversation_max_turns = CASE WHEN $4::integer IS NULL THEN conversation_max_turns ELSE $4::integer END
    WHERE id = $1::uuid
    RETURNING id as attempt_id, eval_id
),
actor_info AS (
    SELECT 
        p.first_name || ' ' || p.last_name as actor_name
    FROM profiles p
    WHERE p.id = $5::uuid
)
SELECT 
    ua.attempt_id::text,
    ua.eval_id::text,
    COALESCE(ai.actor_name, 'System') as actor_name
FROM updated_attempt ua
CROSS JOIN actor_info ai

