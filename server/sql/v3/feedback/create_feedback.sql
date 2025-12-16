-- Parameters: $1=type, $2=message, $3=profile_id
INSERT INTO feedback (type, message, profile_id, created_at)
VALUES ($1, $2, $3::uuid, NOW())
RETURNING id as feedback_id

