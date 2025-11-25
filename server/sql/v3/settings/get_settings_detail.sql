-- Get settings detail by ID
-- Parameters: $1 = settings_id (uuid)
SELECT 
    id::text as settings_id,
    created_at,
    active,
    organization_name,
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
WHERE id = $1::uuid

