-- Parameters: $1=type, $2=message, $3=profile_id (uuid, required)
-- Returns: feedback_id, actor_name
-- profile_id is always a UUID (required in request body)
actor_profile AS (
    SELECT 
        $3::uuid as resolved_profile_id,
        p.first_name || ' ' || p.last_name as actor_name
    FROM profiles p
    WHERE p.id = $3::uuid
),
new_feedback AS (
    INSERT INTO feedback (type, message, profile_id, created_at)
    VALUES ($1::feedback_type, $2, $3::uuid, NOW())
    RETURNING id as feedback_id
)
SELECT 
    nf.feedback_id,
    ap.actor_name
FROM new_feedback nf
CROSS JOIN actor_profile ap

