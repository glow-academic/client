-- Get active settings row
-- Returns the single active settings row (WHERE active = true)
SELECT 
    id::text as settings_id,
    created_at,
    active,
    organization_name,
    organization_description,
    primary_color,
    accent,
    background,
    surface,
    success,
    warning,
    error,
    sidebar_background,
    sidebar_primary,
    chart1,
    chart2,
    chart3,
    chart4,
    chart5,
    guest_login_enabled,
    success_threshold,
    warning_threshold,
    danger_threshold
FROM settings
WHERE active = true
LIMIT 1

