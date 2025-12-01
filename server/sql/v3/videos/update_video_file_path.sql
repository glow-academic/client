UPDATE videos
SET 
    file_path = $2,
    mime_type = $3,
    updated_at = NOW()
WHERE id = $1::uuid
RETURNING id::uuid as video_id

