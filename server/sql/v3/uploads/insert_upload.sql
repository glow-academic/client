-- Insert upload record
-- Parameters: $1=file_path, $2=mime_type, $3=size
-- Returns: id (text)
INSERT INTO uploads (file_path, mime_type, size, created_at, updated_at)
VALUES ($1, $2, $3, NOW(), NOW())
RETURNING id::text as id;

