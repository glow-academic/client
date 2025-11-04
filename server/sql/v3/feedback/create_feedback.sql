WITH new_feedback AS (
    INSERT INTO app_feedback (type, message, created_at)
    VALUES ($1, $2, NOW())
    RETURNING id
)
INSERT INTO app_feedback_profiles (app_feedback_id, profile_id, role)
SELECT nf.id, $3::uuid, 'author'
FROM new_feedback nf
RETURNING (SELECT id FROM new_feedback) as feedback_id

