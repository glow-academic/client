-- Get active settings row with optional department-based lookup
-- Parameters: $1 = department_id (optional, UUID or NULL)
-- Returns: Settings row (department-specific if department_id provided, otherwise default)
-- Logic: 
--   1. If department_id provided, try to find department-specific settings (via settings_departments)
--   2. Fall back to default settings (via settings_default_department) if no department-specific found
--   3. If no department_id, return default settings (via settings_default_department)
--   4. Final fallback: any active settings row
WITH default_department_settings AS (
    -- Get settings linked to default department
    SELECT s.id as settings_id
    FROM settings s
    JOIN settings_default_department sdd ON sdd.settings_id = s.id
    WHERE s.active = true AND sdd.active = true
    LIMIT 1
),
dept_specific_settings AS (
    -- Get department-specific settings (if department_id provided)
    SELECT s.id as settings_id
    FROM settings s
    JOIN settings_departments sd ON sd.settings_id = s.id
    WHERE s.active = true 
      AND sd.active = true
      AND ($1::uuid IS NOT NULL AND sd.department_id = $1::uuid)
    LIMIT 1
),
selected_settings AS (
    -- Prefer department-specific, then default department, then any active
    SELECT COALESCE(
        (SELECT settings_id FROM dept_specific_settings),
        (SELECT settings_id FROM default_department_settings),
        (SELECT id FROM settings WHERE active = true LIMIT 1)
    ) as settings_id
)
SELECT 
    s.id::text as settings_id,
    s.created_at,
    s.active,
    s.organization_name,
    s.organization_description,
    s.primary_color,
    s.accent,
    s.background,
    s.surface,
    s.success,
    s.warning,
    s.error,
    s.sidebar_background,
    s.sidebar_primary,
    s.chart1,
    s.chart2,
    s.chart3,
    s.chart4,
    s.chart5,
    s.guest_login_enabled,
    s.success_threshold,
    s.warning_threshold,
    s.danger_threshold
FROM selected_settings ss
JOIN settings s ON s.id = ss.settings_id
LIMIT 1
