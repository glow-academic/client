-- Get active auth providers for Keycloak sync filtered by department
-- Parameters: $1 = department_id (optional UUID, NULL for default settings)
-- Returns: id, slug, auth_type (as provider_id), name
-- Filters providers by department-specific settings, falls back to default settings
WITH dept_settings AS (
    -- Get department-specific settings if department_id provided
    SELECT DISTINCT s.id as settings_id
    FROM settings s
    JOIN department_settings ds ON ds.settings_id = s.id AND ds.active = true
    WHERE ($1::uuid IS NOT NULL AND ds.department_id = $1::uuid)
      AND s.active = true
),
default_settings AS (
    -- Get default settings (no department links)
    SELECT s.id as settings_id
    FROM settings s
    WHERE s.active = true
      AND NOT EXISTS (
          SELECT 1 FROM department_settings sd 
          WHERE sd.settings_id = s.id AND sd.active = true
      )
    LIMIT 1
),
selected_settings AS (
    -- Priority: department-specific settings, then default settings
    SELECT COALESCE(
        (SELECT settings_id FROM dept_settings LIMIT 1),
        (SELECT settings_id FROM default_settings LIMIT 1)
    ) as settings_id
),
dept_auths AS (
    -- Get auths linked to department-specific settings
    SELECT DISTINCT a.id
    FROM auth a
    JOIN setting_auths sa ON sa.auth_id = a.id AND sa.active = true
    JOIN dept_settings ds ON ds.settings_id = sa.settings_id
    WHERE a.active = true
),
default_auths AS (
    -- Get auths linked to default settings
    SELECT DISTINCT a.id
    FROM auth a
    JOIN setting_auths sa ON sa.auth_id = a.id AND sa.active = true
    JOIN default_settings ds ON ds.settings_id = sa.settings_id
    WHERE a.active = true
)
SELECT 
    a.id, 
    a.slug, 
    a.auth_type as provider_id, 
    a.name 
FROM auth a
WHERE a.active = true
  AND (
      -- If department_id provided, only include department-specific auths
      ($1::uuid IS NOT NULL AND EXISTS (SELECT 1 FROM dept_auths da WHERE da.id = a.id))
      -- If no department_id, include all auths from default settings
      OR ($1::uuid IS NULL AND EXISTS (SELECT 1 FROM default_auths da WHERE da.id = a.id))
  )
ORDER BY a.slug;

