-- Create a basic video record
-- Parameters: $1 = name (text), $2 = length_seconds (integer)
-- Returns: id (uuid)

INSERT INTO videos (name, length_seconds, completed, active, image_enabled, created_at, updated_at)
VALUES ($1::text, $2::integer, false, true, false, NOW(), NOW())
RETURNING id;

