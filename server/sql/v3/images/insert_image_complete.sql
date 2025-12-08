-- Insert image record
-- Parameters: $1=name, $2=upload_id
-- Returns: id (text)
INSERT INTO images (name, upload_id, created_at, updated_at, active)
VALUES ($1, $2, NOW(), NOW(), true)
RETURNING id::text as id;

