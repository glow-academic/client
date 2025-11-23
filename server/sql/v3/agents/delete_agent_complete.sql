-- Delete agent with usage check - returns usage_count and deleted (boolean)
-- Parameters: $1 = agent_id (uuid), $2 = profile_id (uuid or "guest-profile-id")
-- Returns: usage_count (int), deleted (boolean)

WITH resolve_profile_id AS (
    SELECT 
        CASE 
            WHEN $2::text = 'guest-profile-id' THEN
                (SELECT id::uuid FROM profiles WHERE role = 'guest' AND default_profile = true ORDER BY created_at DESC LIMIT 1)
            WHEN $2::text IS NULL OR $2::text = '' THEN NULL::uuid
            ELSE $2::uuid
        END as resolved_profile_id
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
    CASE WHEN EXISTS(SELECT 1 FROM delete_result) THEN true ELSE false END as deleted

