-- Get active auth providers for login page
-- Returns slug (id), name, and icon_url for dynamic frontend rendering
-- Also returns guest_login_enabled from active settings
WITH active_settings AS (
    SELECT guest_login_enabled
    FROM settings
    WHERE active = true
    LIMIT 1
)
SELECT 
    a.slug as id, 
    a.name, 
    a.icon_url as icon,
    COALESCE(s.guest_login_enabled, true) as guest_login_enabled
FROM auth a
CROSS JOIN (SELECT guest_login_enabled FROM active_settings LIMIT 1) s
WHERE a.active = true
ORDER BY a.name;

