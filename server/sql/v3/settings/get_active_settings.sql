-- Get active settings row
-- Returns the single active settings row (WHERE active = true)
SELECT 
    id::text as settings_id,
    created_at,
    active,
    color,
    organization_name
FROM settings
WHERE active = true
LIMIT 1

