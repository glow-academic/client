-- Insert image record
-- Parameters: $1=name
-- Returns: id (text)
INSERT INTO images (name, created_at, updated_at, active)
VALUES ($1, NOW(), NOW(), true)
RETURNING id::text as id;

