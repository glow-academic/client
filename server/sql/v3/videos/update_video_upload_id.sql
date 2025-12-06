-- Update video upload_id via video_uploads junction table
-- Parameters: $1=video_id (text), $2=upload_id (uuid)
-- Deactivates any existing active uploads for this video, then inserts/activates the new upload_id

-- First, deactivate any existing active uploads for this video
UPDATE video_uploads
SET active = false,
    updated_at = NOW()
WHERE video_id = $1::uuid AND active = true;

-- Then insert/activate the new upload_id
INSERT INTO video_uploads (video_id, upload_id, active, created_at, updated_at)
VALUES ($1::uuid, $2::uuid, true, NOW(), NOW())
ON CONFLICT (video_id, upload_id) DO UPDATE SET
    active = true,
    updated_at = NOW();

