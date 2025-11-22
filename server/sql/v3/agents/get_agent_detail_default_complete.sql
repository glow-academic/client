WITH user_profile AS (
    SELECT role FROM profiles WHERE id = $1::uuid
),
primary_department_id AS (
    SELECT department_id::text
    FROM profile_departments
    WHERE profile_id = $1::uuid AND is_primary = TRUE
    LIMIT 1
),
user_departments_for_models AS (
    SELECT DISTINCT pd.department_id
    FROM profile_departments pd
    WHERE pd.profile_id = $1::uuid
),
valid_models AS (
    -- Filter models by department: include if has matching department link OR has no department links at all (cross-dept)
    SELECT 
        m.id::text as model_id,
        m.name,
        COALESCE(m.description, '') as description,
        m.active
    FROM models m
    LEFT JOIN model_departments md ON md.model_id = m.id AND md.active = true
    WHERE m.active = true
    GROUP BY m.id, m.name, m.description, m.active
    HAVING 
        COUNT(md.model_id) FILTER (WHERE md.department_id IN (SELECT department_id FROM user_departments_for_models)) > 0
        OR NOT EXISTS (SELECT 1 FROM model_departments md2 WHERE md2.model_id = m.id AND md2.active = true)
    ORDER BY m.name
),
user_departments AS (
    SELECT DISTINCT d.id, d.title as name, d.description
    FROM departments d
    JOIN profile_departments pd ON pd.department_id = d.id
    WHERE d.active = true
    AND pd.profile_id = $1::uuid
    AND pd.active = true
),
valid_departments_data AS (
    SELECT 
        COALESCE(
            jsonb_object_agg(
                ud.id::text,
                jsonb_build_object(
                    'name', ud.name,
                    'description', COALESCE(ud.description, '')
                )
            ),
            '{}'::jsonb
        ) as dept_mapping,
        array_agg(ud.id::text ORDER BY ud.name) as dept_ids
    FROM user_departments ud
)
SELECT 
    COALESCE(
        (SELECT jsonb_object_agg(
            vm.model_id,
            jsonb_build_object('name', vm.name, 'description', vm.description)
        )
        FROM valid_models vm),
        '{}'::jsonb
    ) as model_mapping,
    COALESCE(
        (SELECT jsonb_agg(vm.model_id ORDER BY vm.name)
        FROM valid_models vm),
        '[]'::jsonb
    ) as valid_model_ids,
    COALESCE(vdd.dept_ids, ARRAY[]::text[]) as valid_department_ids,
    COALESCE(vdd.dept_mapping, '{}'::jsonb) as department_mapping,
    up.role as user_role,
    pdi.department_id as primary_department_id
FROM (SELECT 1) dummy
CROSS JOIN valid_departments_data vdd
CROSS JOIN user_profile up
LEFT JOIN primary_department_id pdi ON true

