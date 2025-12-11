-- Link a question to a video
-- Parameters: $1 = video_id (uuid), $2 = question_id (uuid), $3 = active (boolean)
-- Creates or updates video_questions junction table entry

INSERT INTO video_questions (video_id, question_id, active, created_at, updated_at)
VALUES ($1::uuid, $2::uuid, $3::boolean, NOW(), NOW())
ON CONFLICT (video_id, question_id) DO UPDATE SET
    active = EXCLUDED.active,
    updated_at = NOW()
RETURNING question_id;
