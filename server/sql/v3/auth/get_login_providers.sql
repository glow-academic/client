-- Get active auth providers for login page
-- Returns slug (id), name, and icon_url for dynamic frontend rendering
SELECT slug as id, name, icon_url as icon
FROM auth
WHERE active = true
ORDER BY name;

