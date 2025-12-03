-- Insert image in single transaction
-- Parameters: 
--   $1 = image_id (uuid)
--   $2 = name (text)
--   $3 = upload_id (uuid)
-- Returns: image_id (text)

INSERT INTO images (id, name, upload_id, active, created_at, updated_at)
VALUES ($1, $2, $3, true, NOW(), NOW())
RETURNING id::text as image_id

