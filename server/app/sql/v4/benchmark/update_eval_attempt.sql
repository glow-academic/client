-- Update eval attempt settings
-- Parameters: 
--   $1 = attempt_id (uuid)
--   $2 = infinite_mode (boolean, nullable)
-- Returns: attempt_id, actor_name

WITH updated_attempt AS (
    UPDATE eval_attempts
    SET 
        infinite_mode = COALESCE($2::bool, infinite_mode)
    WHERE id = $1::uuid
    RETURNING id as attempt_id, eval_id
),
actor_info AS (
    SELECT 
        p.first_name || ' ' || p.last_name as actor_name
    FROM profiles p
    WHERE p.id = $3::uuid
)
SELECT 
    ua.attempt_id::text,
    ua.eval_id::text,
    COALESCE(ai.actor_name, 'System') as actor_name
FROM updated_attempt ua
CROSS JOIN actor_info ai

