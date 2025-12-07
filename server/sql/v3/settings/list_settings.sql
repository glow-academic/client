-- Get all settings ordered by created_at DESC (for picker)
-- Includes department_ids array (NULL for default settings with no department links)
WITH settings_departments_data AS (
    SELECT 
        ds.settings_id,
        ARRAY_AGG(ds.department_id::text ORDER BY ds.created_at) as department_ids
    FROM department_settings ds
    WHERE ds.active = true
    GROUP BY ds.settings_id
)
SELECT 
    s.id::text as settings_id,
    s.created_at,
    s.active,
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
    sdd.department_ids
FROM settings s
LEFT JOIN settings_departments_data sdd ON sdd.settings_id = s.id
ORDER BY s.created_at DESC

