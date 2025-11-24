-- Insert policy in single transaction
-- Parameters: 
--   $1 = policy_id (uuid)
--   $2 = name (text)
--   $3 = description (text)
--   $4 = file_path (text)
--   $5 = mime_type (text)
-- Returns: policy_id (text)

INSERT INTO policies (id, name, description, file_path, mime_type, active, created_at, updated_at)
VALUES ($1, $2, $3, $4, $5, true, NOW(), NOW())
RETURNING id::text as policy_id

