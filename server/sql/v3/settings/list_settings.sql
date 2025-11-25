-- Get all settings ordered by created_at DESC (for picker)
SELECT 
    id::text as settings_id,
    created_at,
    active,
    color,
    organization_name
FROM settings
ORDER BY created_at DESC

