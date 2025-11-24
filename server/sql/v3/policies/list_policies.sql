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
policy_departments_data AS (
    SELECT 
        pd.policy_id,
        ARRAY_AGG(pd.department_id::text ORDER BY pd.created_at) as department_ids
    FROM policy_departments pd
    WHERE pd.active = true
    GROUP BY pd.policy_id
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
        COALESCE(pdd.department_ids, NULL) as department_ids,
        CASE 
            WHEN up.role IN ('admin', 'instructional', 'superadmin') THEN true
            ELSE false
        END as can_edit,
        CASE 
            WHEN up.role IN ('admin', 'instructional', 'superadmin') THEN true
            ELSE false
        END as can_delete
    FROM policies p
    LEFT JOIN policy_departments pd ON pd.policy_id = p.id AND pd.active = true
    LEFT JOIN policy_departments_data pdd ON pdd.policy_id = p.id
    CROSS JOIN user_profile up
    WHERE p.active = true
    GROUP BY p.id, p.name, p.description, p.file_path, p.mime_type, p.active, p.created_at, p.updated_at, pdd.department_ids, up.role
    HAVING 
        COUNT(pd.policy_id) FILTER (WHERE pd.department_id IN (SELECT department_id FROM user_departments)) > 0
        OR NOT EXISTS (SELECT 1 FROM policy_departments pd2 WHERE pd2.policy_id = p.id AND pd2.active = true)
),
department_mapping_data AS (
    SELECT COALESCE(
        jsonb_object_agg(
            d.id::text,
            jsonb_build_object(
                'name', d.title,
                'description', COALESCE(d.description, '')
            )
        ) FILTER (WHERE d.id IS NOT NULL),
        '{}'::jsonb
    ) as mapping
    FROM departments d
    WHERE d.id IN (SELECT department_id FROM user_departments)
)
SELECT 
    pd.*,
    COALESCE(dm.mapping, '{}'::jsonb) as department_mapping
FROM policy_data pd
CROSS JOIN department_mapping_data dm
ORDER BY pd.updated_at DESC NULLS LAST

