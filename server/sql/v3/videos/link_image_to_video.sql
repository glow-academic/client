-- Link an image to a video
-- Parameters: $1 = video_id (uuid), $2 = image_id (uuid), $3 = active (boolean)
-- Creates or updates video_images junction table entry

INSERT INTO video_images (video_id, image_id, active, created_at, updated_at)
VALUES ($1::uuid, $2::uuid, $3::boolean, NOW(), NOW())
ON CONFLICT (video_id, image_id) DO UPDATE SET
    active = EXCLUDED.active,
    updated_at = NOW()
RETURNING image_id;
