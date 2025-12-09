-- Update upload record with final file_path, mime_type, and size
-- Parameters: $1=upload_id, $2=file_path, $3=mime_type, $4=size
UPDATE uploads
SET file_path = $2,
    mime_type = $3,
    size = $4,
    updated_at = NOW()
WHERE id = $1::uuid;

