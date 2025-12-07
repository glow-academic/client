-- Get default department data for new department creation
-- Parameters: $1=profileId
-- Returns: profile_role, settings_mapping
WITH user_profile AS (
    SELECT role FROM profiles WHERE id = $1
),
settings_departments_data AS (
    -- Get department_ids for each setting
    SELECT 
        ds.settings_id,
        ARRAY_AGG(ds.department_id::text ORDER BY ds.created_at) as department_ids
    FROM department_settings ds
    WHERE ds.active = true
    GROUP BY ds.settings_id
),
settings_mapping_data AS (
    SELECT COALESCE(
        jsonb_object_agg(
            s.id::text,
            jsonb_build_object(
                'settings_id', s.id::text,
                'created_at', s.created_at::text,
                'active', s.active,
                'department_ids', COALESCE(sdd.department_ids, NULL)
            )
        ) FILTER (WHERE s.id IS NOT NULL),
        '{}'::jsonb
    ) as settings_mapping
    FROM settings s
    LEFT JOIN settings_departments_data sdd ON sdd.settings_id = s.id::text
    WHERE s.active = true
)
SELECT 
    up.role as profile_role,
    COALESCE(smd.settings_mapping, '{}'::jsonb) as settings_mapping
FROM user_profile up
CROSS JOIN settings_mapping_data smd

