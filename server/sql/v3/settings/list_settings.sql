-- Get all active settings with their department_ids ordered by created_at DESC
-- Parameters: $1=profile_id (uuid, required)
-- Returns ALL settings (both global/default and department-specific)
-- Returns: settings data + actor_name
WITH actor_profile AS (
    SELECT 
        p.first_name || ' ' || p.last_name as actor_name
    FROM profiles p
    WHERE p.id = $1::uuid
),
settings_departments_data AS (
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
    s.name,
    s.description,
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
    COALESCE(sdd.department_ids, NULL) as department_ids,  -- NULL = global settings, array = department-specific
    ap.actor_name
FROM settings s
LEFT JOIN settings_departments_data sdd ON sdd.settings_id = s.id
CROSS JOIN actor_profile ap
WHERE s.active = true  -- Only return active settings
ORDER BY s.created_at DESC

