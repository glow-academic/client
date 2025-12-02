-- Update video name
-- Parameters: $1=video_id, $2=name
-- Returns: video_id and updated name
UPDATE videos
SET 
    name = $2,
    updated_at = NOW()
WHERE id = $1::uuid
RETURNING id::uuid as video_id, name

