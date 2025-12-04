-- Get active auth providers for login page with optional department filtering
-- Parameters: $1 = department_id (optional, UUID or NULL)
-- Returns slug (id), name, icon_url, and guest_login_enabled from active settings
-- Logic: If department_id provided, show department-specific + default (no links) providers
--        If no department_id, show all active providers (default behavior)
WITH active_settings AS (
    SELECT guest_login_enabled
    FROM settings
    WHERE active = true
    LIMIT 1
),
-- Get default providers (no department links)
default_providers AS (
    SELECT a.id
    FROM auth a
    WHERE a.active = true
      AND NOT EXISTS (
          SELECT 1 FROM auth_departments ad 
          WHERE ad.auth_id = a.id AND ad.active = true
      )
),
-- Get department-specific providers (if department_id provided)
dept_providers AS (
    SELECT a.id
    FROM auth a
    JOIN auth_departments ad ON ad.auth_id = a.id
    WHERE a.active = true
      AND ad.active = true
      AND ($1::uuid IS NULL OR ad.department_id = $1::uuid)
)
SELECT 
    a.slug as id, 
    a.name, 
    a.icon_url as icon,
    COALESCE(s.guest_login_enabled, true) as guest_login_enabled,
    -- Indicate if this is a default provider (no department links)
    EXISTS (SELECT 1 FROM default_providers dp WHERE dp.id = a.id) as is_default
FROM auth a
CROSS JOIN (SELECT guest_login_enabled FROM active_settings LIMIT 1) s
WHERE a.active = true
  AND (
      -- Include if department_id not provided (show all)
      $1::uuid IS NULL
      -- OR include if it's a default provider (no department links)
      OR EXISTS (SELECT 1 FROM default_providers dp WHERE dp.id = a.id)
      -- OR include if it's linked to the specified department
      OR EXISTS (SELECT 1 FROM dept_providers dp WHERE dp.id = a.id)
  )
ORDER BY a.name;
