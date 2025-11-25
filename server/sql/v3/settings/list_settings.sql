-- Get all settings ordered by created_at DESC (for picker)
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
    chart5
FROM settings
ORDER BY created_at DESC

