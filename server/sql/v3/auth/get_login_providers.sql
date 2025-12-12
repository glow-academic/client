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
-- Get settings for the department (if department_id provided)
-- Note: Include department-specific settings even if inactive (they're linked via department_settings)
dept_settings AS (
    SELECT DISTINCT s.id as settings_id
    FROM settings s
    JOIN department_settings ds ON ds.settings_id = s.id
    WHERE ds.active = true
      AND ($1::uuid IS NULL OR ds.department_id = $1::uuid)
),
-- Get default settings (no department links)
default_settings AS (
    SELECT s.id as settings_id
    FROM settings s
    WHERE s.active = true
      AND NOT EXISTS (
          SELECT 1 FROM department_settings ds 
          WHERE ds.settings_id = s.id AND ds.active = true
      )
    LIMIT 1
),
-- Get auths linked to department settings or default settings
dept_auths AS (
    SELECT DISTINCT a.id
    FROM auth a
    JOIN setting_auths sa ON sa.auth_id = a.id AND sa.active = true
    JOIN dept_settings ds ON ds.settings_id = sa.settings_id
    WHERE a.active = true
),
-- Get auths linked to default settings
default_auths AS (
    SELECT DISTINCT a.id
    FROM auth a
    JOIN setting_auths sa ON sa.auth_id = a.id AND sa.active = true
    JOIN default_settings ds ON ds.settings_id = sa.settings_id
    WHERE a.active = true
)
SELECT 
    a.slug as id, 
    a.name, 
    a.icon_url as icon,
    COALESCE(s.guest_login_enabled, true) as guest_login_enabled,
    -- Indicate if this is a default provider (linked to default settings)
    EXISTS (SELECT 1 FROM default_auths da WHERE da.id = a.id) as is_default
FROM auth a
CROSS JOIN (SELECT guest_login_enabled FROM active_settings LIMIT 1) s
WHERE a.active = true
  AND (
      -- Include if department_id not provided (show all auths from all settings)
      $1::uuid IS NULL
      -- OR if department_id is provided, ONLY include department-specific auths (exclude default ones)
      OR (
          $1::uuid IS NOT NULL
          AND EXISTS (SELECT 1 FROM dept_auths da WHERE da.id = a.id)
      )
  )
ORDER BY a.name;
