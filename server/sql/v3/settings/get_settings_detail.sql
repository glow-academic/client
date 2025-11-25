-- Get settings detail by ID
-- Parameters: $1 = settings_id (uuid)
SELECT 
    id::text as settings_id,
    created_at,
    active,
    color,
    organization_name
FROM settings
WHERE id = $1::uuid

