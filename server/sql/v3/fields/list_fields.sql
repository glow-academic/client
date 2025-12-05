WITH user_departments AS (
    SELECT department_id
    FROM profile_departments
    WHERE profile_id = $1 AND active = true
),
user_profile AS (
    SELECT role FROM profiles WHERE id = $1
),
field_parameters_agg AS (
    SELECT 
        fp.field_id,
        ARRAY_AGG(fp.parameter_id::text ORDER BY p.name) as parameter_ids
    FROM field_parameters fp
    JOIN parameters p ON p.id = fp.parameter_id
    WHERE fp.active = true
    GROUP BY fp.field_id
),
field_departments_data AS (
    SELECT 
        fd.field_id,
        ARRAY_AGG(fd.department_id::text ORDER BY fd.created_at) as department_ids
    FROM field_departments fd
    WHERE fd.active = true
    GROUP BY fd.field_id
),
all_parameter_ids AS (
    SELECT DISTINCT unnest(parameter_ids)::uuid as parameter_id
    FROM field_parameters_agg
),
parameter_mapping_data AS (
    SELECT COALESCE(
        jsonb_object_agg(
            p.id::text,
            jsonb_build_object(
                'name', p.name,
                'description', COALESCE(p.description, '')
            )
        ) FILTER (WHERE p.id IS NOT NULL),
        '{}'::jsonb
    ) as mapping
    FROM all_parameter_ids api
    LEFT JOIN parameters p ON p.id = api.parameter_id
),
all_department_ids AS (
    SELECT DISTINCT unnest(department_ids)::uuid as department_id
    FROM field_departments_data
    WHERE department_ids IS NOT NULL
    UNION
    SELECT department_id FROM user_departments
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
    FROM all_department_ids adi
    LEFT JOIN departments d ON d.id = adi.department_id
)
SELECT 
    f.id as field_id,
    f.name,
    f.description,
    f.value,
    f.default_field,
    f.created_at,
    f.updated_at,
    COALESCE(fdd.department_ids, NULL) as department_ids,
    COALESCE(fpa.parameter_ids, ARRAY[]::text[]) as parameter_ids,
    CASE 
        WHEN COALESCE(fdd.department_ids, NULL) IS NULL AND up.role != 'superadmin' THEN false
        WHEN up.role IN ('admin', 'superadmin') THEN true
        ELSE false
    END as can_edit,
    CASE 
        -- Can't delete if can't edit (stricter than can_edit)
        WHEN COALESCE(fdd.department_ids, NULL) IS NULL AND up.role != 'superadmin' THEN false
        WHEN up.role IN ('admin', 'superadmin') THEN true
        ELSE false
    END as can_delete,
    true as can_duplicate,
    pmd.mapping as parameter_mapping,
    dmd.mapping as department_mapping
FROM fields f
LEFT JOIN field_departments_data fdd ON fdd.field_id = f.id
LEFT JOIN field_parameters_agg fpa ON fpa.field_id = f.id
CROSS JOIN user_profile up
CROSS JOIN parameter_mapping_data pmd
CROSS JOIN department_mapping_data dmd
WHERE (
    -- Include fields with no departments (cross-department)
    NOT EXISTS (SELECT 1 FROM field_departments fd2 WHERE fd2.field_id = f.id AND fd2.active = true)
    OR
    -- Include fields in user's departments
    EXISTS (
        SELECT 1 FROM field_departments fd
        WHERE fd.field_id = f.id 
        AND fd.department_id IN (SELECT department_id FROM user_departments)
        AND fd.active = true
    )
)
GROUP BY f.id, f.name, f.description, f.value, f.default_field, f.created_at, f.updated_at,
         fdd.department_ids, fpa.parameter_ids, up.role, pmd.mapping, dmd.mapping
ORDER BY f.name

