WITH field_id_resolved AS (
    SELECT $1::uuid as field_id
),
resolve_profile_id AS (
    SELECT $2::uuid as resolved_profile_id
),
user_profile AS (
    SELECT 
        up.id,
        up.role,
        COALESCE(up.first_name || ' ' || up.last_name, 'System') as actor_name
    FROM resolve_profile_id rpi
    JOIN profiles up ON up.id = rpi.resolved_profile_id
),
field_parameters_data AS (
    SELECT 
        pf.field_id,
        ARRAY_AGG(pf.parameter_id::text ORDER BY p.name) as parameter_ids
    FROM field_id_resolved fid
    JOIN parameter_fields pf ON pf.field_id = fid.field_id AND pf.active = true
    JOIN parameters p ON p.id = pf.parameter_id
    GROUP BY pf.field_id
),
field_conditional_parameters_data AS (
    SELECT 
        fcp.field_id,
        ARRAY_AGG(fcp.conditional_parameter_id::text ORDER BY p.name) as conditional_parameter_ids
    FROM field_id_resolved fid
    JOIN field_conditional_parameters fcp ON fcp.field_id = fid.field_id AND fcp.active = true
    JOIN parameters p ON p.id = fcp.conditional_parameter_id
    GROUP BY fcp.field_id
),
field_departments_data AS (
    SELECT 
        fd.field_id,
        ARRAY_AGG(fd.department_id::text ORDER BY fd.created_at) as department_ids
    FROM field_id_resolved fid
    LEFT JOIN field_departments fd ON fd.field_id = fid.field_id AND fd.active = true
    GROUP BY fd.field_id
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
user_has_field_access AS (
    SELECT EXISTS(
        SELECT 1 FROM field_departments fd
        JOIN profile_departments pd ON pd.department_id = fd.department_id
        WHERE fd.field_id = (SELECT field_id FROM field_id_resolved)
        AND fd.active = true
        AND pd.profile_id = (SELECT resolved_profile_id FROM resolve_profile_id)
        AND pd.active = true
    ) OR EXISTS(
        SELECT 1 FROM resolve_profile_id rpi
        JOIN profiles p ON p.id = rpi.resolved_profile_id
        WHERE p.role = 'superadmin'
    ) OR (
        SELECT NOT EXISTS(
            SELECT 1 FROM field_departments fd2
            WHERE fd2.field_id = (SELECT field_id FROM field_id_resolved)
            AND fd2.active = true
        )
    ) as has_access
)
SELECT 
    f.id as field_id,
    f.name,
    f.description,
    f.active,
    COALESCE(fdd.department_ids, NULL) as department_ids,
    COALESCE(fpd.parameter_ids, ARRAY[]::text[]) as parameter_ids,
    COALESCE(fcpd.conditional_parameter_ids, ARRAY[]::text[]) as conditional_parameter_ids,
    vdd.dept_mapping as department_mapping,
    vdd.dept_ids as valid_department_ids,
    vpd.param_mapping as parameter_mapping,
    vpd.param_ids as valid_parameter_ids,
    CASE 
        WHEN COALESCE(fdd.department_ids, NULL) IS NULL AND up.role != 'superadmin' THEN false
        WHEN up.role IN ('admin', 'superadmin') THEN true
        ELSE false
    END as can_edit,
    up.actor_name
FROM field_id_resolved fid
JOIN fields f ON f.id = fid.field_id
LEFT JOIN field_departments_data fdd ON fdd.field_id = f.id
LEFT JOIN field_parameters_data fpd ON fpd.field_id = f.id
LEFT JOIN field_conditional_parameters_data fcpd ON fcpd.field_id = f.id
CROSS JOIN user_profile up
CROSS JOIN valid_departments_data vdd
CROSS JOIN valid_parameters_data vpd
CROSS JOIN user_has_field_access uha
WHERE uha.has_access = true
AND f.active = true

