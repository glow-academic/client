WITH resolve_profile_id AS (
    SELECT $1::uuid as resolved_profile_id
),
user_profile AS (
    SELECT 
        up.id,
        up.role,
        up.name as actor_name
    FROM resolve_profile_id rpi
    JOIN profiles up ON up.id = rpi.resolved_profile_id
),
user_departments AS (
    SELECT department_id
    FROM profile_departments
    JOIN resolve_profile_id rpi ON profile_id = rpi.resolved_profile_id
    WHERE active = true
),
valid_departments_data AS (
    SELECT 
        COALESCE(
            jsonb_object_agg(
                d.id::text,
                jsonb_build_object(
                    'name', d.title,
                    'description', COALESCE(d.description, '')
                )
            ) FILTER (WHERE d.id IS NOT NULL),
            '{}'::jsonb
        ) as dept_mapping,
        ARRAY_AGG(d.id::text ORDER BY d.title) FILTER (WHERE d.id IS NOT NULL) as dept_ids
    FROM departments d
    WHERE d.id IN (SELECT department_id FROM user_departments)
       OR EXISTS (SELECT 1 FROM user_profile WHERE role = 'superadmin')
),
valid_parameters_data AS (
    SELECT 
        COALESCE(
            jsonb_object_agg(
                p.id::text,
                jsonb_build_object(
                    'name', p.name,
                    'description', COALESCE(p.description, '')
                )
            ) FILTER (WHERE p.id IS NOT NULL),
            '{}'::jsonb
        ) as param_mapping,
        ARRAY_AGG(p.id::text ORDER BY p.name) FILTER (WHERE p.id IS NOT NULL) as param_ids
    FROM parameters p
    WHERE p.active = true
),
primary_department_data AS (
    SELECT 
        pd.department_id::text as primary_department_id
    FROM profile_departments pd
    JOIN resolve_profile_id rpi ON pd.profile_id = rpi.resolved_profile_id
    WHERE pd.active = true
    ORDER BY pd.created_at
    LIMIT 1
)
SELECT 
    vdd.dept_mapping as department_mapping,
    vdd.dept_ids as valid_department_ids,
    vpd.param_mapping as parameter_mapping,
    vpd.param_ids as valid_parameter_ids,
    up.role::text as user_role,
    pdd.primary_department_id,
    up.actor_name
FROM user_profile up
CROSS JOIN valid_departments_data vdd
CROSS JOIN valid_parameters_data vpd
LEFT JOIN primary_department_data pdd ON true

