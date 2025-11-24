-- Insert image in single transaction
-- Parameters: 
--   $1 = image_id (uuid)
--   $2 = name (text)
--   $3 = file_path (text)
--   $4 = mime_type (text)
-- Returns: image_id (text)

INSERT INTO images (id, name, file_path, mime_type, active, created_at, updated_at)
VALUES ($1, $2, $3, $4, true, NOW(), NOW())
RETURNING id::text as image_id

