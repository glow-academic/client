WITH user_departments AS (
    SELECT department_id
    FROM profile_departments
    WHERE profile_id = $1 AND active = true
),
user_profile AS (
    SELECT 
        role,
        (SELECT department_id FROM profile_departments WHERE profile_id = $1 AND active = true LIMIT 1) as primary_department_id
    FROM profiles WHERE id = $1
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
),
department_ids_array AS (
    SELECT ARRAY_AGG(department_id::text ORDER BY department_id) as department_ids
    FROM user_departments
)
SELECT 
    COALESCE((SELECT department_ids FROM department_ids_array), ARRAY[]::text[]) as department_ids,
    COALESCE((SELECT mapping FROM department_mapping_data), '{}'::jsonb) as department_mapping,
    (SELECT role FROM user_profile) as user_role,
    (SELECT primary_department_id::text FROM user_profile) as primary_department_id

