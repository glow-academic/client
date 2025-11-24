-- List policies with department access control
-- Parameters: $1 = profile_id (uuid)

WITH user_departments AS (
    SELECT department_id
    FROM profile_departments
    WHERE profile_id = $1 AND active = true
),
user_profile AS (
    SELECT role FROM profiles WHERE id = $1
),
policy_data AS (
    SELECT 
        p.id as policy_id,
        p.name,
        p.description,
        p.file_path,
        p.mime_type,
        p.active,
        p.created_at,
        p.updated_at,
        CASE 
            WHEN up.role IN ('admin', 'instructional', 'superadmin') THEN true
            ELSE false
        END as can_edit,
        CASE 
            WHEN up.role IN ('admin', 'instructional', 'superadmin') THEN true
            ELSE false
        END as can_delete
    FROM policies p
    CROSS JOIN user_profile up
    WHERE p.active = true
)
SELECT 
    pd.*,
    '{}'::jsonb as department_mapping
FROM policy_data pd
ORDER BY pd.updated_at DESC NULLS LAST

