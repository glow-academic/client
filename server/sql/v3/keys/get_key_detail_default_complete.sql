-- Get default key structure for new key creation
-- Parameters: $1=profileId
WITH user_departments AS (
    SELECT DISTINCT pd.department_id
    FROM profile_departments pd
    WHERE pd.profile_id = $1::uuid AND pd.active = true
),
valid_depts AS (
    SELECT 
        COALESCE(
            jsonb_object_agg(
                d.id::text,
                jsonb_build_object(
                    'name', d.title,
                    'description', COALESCE(d.description, '')
                )
            ),
            '{}'::jsonb
        ) as dept_mapping,
        array_agg(d.id::text ORDER BY d.title) as dept_ids
    FROM departments d
    JOIN profile_departments pd ON d.id = pd.department_id
    WHERE pd.profile_id = $1::uuid AND d.active = true AND pd.active = true
),
profile_data AS (
    SELECT role as user_role 
    FROM profiles 
    WHERE id = $1::uuid
),
primary_department_id AS (
    SELECT department_id::text
    FROM profile_departments
    WHERE profile_id = $1::uuid AND is_primary = TRUE AND active = true
    LIMIT 1
)
SELECT 
    '' as key_id,
    '' as name,
    '****' as key_masked,
    'api' as type,
    true as active,
    NOW() as created_at,
    NOW() as updated_at,
    -- Set default department_ids based on role
    -- Superadmin: NULL (empty = all departments = default object)
    -- Non-superadmin: [primaryDepartmentId] if available
    CASE 
        WHEN pr.user_role = 'superadmin' THEN NULL
        WHEN pd.department_id IS NOT NULL THEN ARRAY[pd.department_id]
        ELSE ARRAY[]::text[]
    END as department_ids,
    ARRAY[]::text[] as model_ids,
    vd.dept_mapping as department_mapping,
    vd.dept_ids as valid_department_ids,
    pr.user_role,
    pd.department_id,
    '{}'::jsonb as model_mapping,
    -- Default keys (empty department_ids) are read-only for non-superadmin
    CASE 
        WHEN pr.user_role = 'superadmin' THEN true
        WHEN pr.user_role = 'admin' AND pd.department_id IS NOT NULL THEN true
        ELSE false
    END as can_edit
FROM valid_depts vd
CROSS JOIN profile_data pr
LEFT JOIN primary_department_id pd ON true

