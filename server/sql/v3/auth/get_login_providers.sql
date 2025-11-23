-- Get active auth provider names for login page
-- Returns only the name field from active auth providers
SELECT name
FROM auth
WHERE active = true
ORDER BY name;

