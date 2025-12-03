-- Update video upload_id
-- Parameters: $1=video_id (text), $2=upload_id (uuid)

UPDATE videos
SET upload_id = $2::uuid,
    updated_at = NOW()
WHERE id = $1::uuid;

