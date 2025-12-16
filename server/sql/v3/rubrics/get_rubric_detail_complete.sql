-- Get rubric detail with departments, standard groups, and access control
-- Parameters: $1 = rubric_id (uuid), $2 = profile_id (uuid)

WITH rubric_data AS (
    SELECT 
        name,
        description,
        active,
        points,
        pass_points as passpoints
    FROM rubrics
    WHERE id = $1
),
rubric_departments_data AS (
    SELECT 
        ARRAY_AGG(rd.department_id::text ORDER BY rd.created_at) as department_ids
    FROM rubric_departments rd
    WHERE rd.rubric_id = $1 AND rd.active = true
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
    JOIN resolve_profile_id rpi ON true
    JOIN profile_departments pd ON d.id = pd.department_id
    WHERE pd.profile_id = rpi.resolved_profile_id AND d.active = true
),
user_profile AS (
    SELECT 
        role as user_role,
        COALESCE(p.first_name || ' ' || p.last_name, 'System') as actor_name
    FROM profiles p
    WHERE p.id = $2::uuid
),
profile_data AS (
    SELECT user_role FROM user_profile
),
user_has_rubric_access AS (
    -- Check if user has access to rubric via department links
    SELECT EXISTS(
        SELECT 1 FROM rubric_departments rd
        JOIN resolve_profile_id rpi ON true
        JOIN profile_departments pd ON pd.department_id = rd.department_id
        WHERE rd.rubric_id = $1 AND rd.active = true
        AND pd.profile_id = rpi.resolved_profile_id AND pd.active = true
    ) OR EXISTS(
        SELECT 1 FROM resolve_profile_id rpi
        JOIN profiles p ON p.id = rpi.resolved_profile_id
        WHERE p.role = 'superadmin'
    ) OR (
        -- Default rubrics (no department links) are accessible to all
        SELECT COUNT(*) FROM rubric_departments rd
        WHERE rd.rubric_id = $1 AND rd.active = true
    ) = 0 as has_access
),
standard_groups_with_standards AS (
    SELECT 
        COALESCE(
            jsonb_agg(
                jsonb_build_object(
                    'id', sg.id::text,
                    'name', sg.name,
                    'description', COALESCE(sg.description, ''),
                    'points', sg.points,
                    'passPoints', sg.pass_points,
                    'position', sg.position,
                    'active', sg.active,
                    'standards', (
                        SELECT COALESCE(
                            jsonb_agg(
                                jsonb_build_object(
                                    'id', s.id::text,
                                    'name', s.name,
                                    'description', COALESCE(s.description, ''),
                                    'points', s.points
                                )
                                ORDER BY s.name
                            ),
                            '[]'::jsonb
                        )
                        FROM standards s
                        WHERE s.standard_group_id = sg.id
                    )
                )
                ORDER BY sg.position
            ),
            '[]'::jsonb
        ) as groups_json
    FROM standard_groups sg
    WHERE sg.rubric_id = $1
)
SELECT 
    r.*,
    rdd.department_ids,
    vd.dept_mapping as department_mapping,
    vd.dept_ids as valid_department_ids,
    pr.user_role,
    up.actor_name,
    sg.groups_json as standard_groups_complete,
    CASE 
        -- Default rubrics (no department_ids) are read-only for non-superadmin
        WHEN (COALESCE(rdd.department_ids, ARRAY[]::text[]) = ARRAY[]::text[] AND pr.user_role != 'superadmin') THEN false
        WHEN pr.user_role = 'superadmin' THEN true
        WHEN pr.user_role IN ('admin', 'instructional') AND uhra.has_access THEN true
        ELSE false
    END as can_edit
FROM rubric_data r
LEFT JOIN rubric_departments_data rdd ON true
CROSS JOIN valid_depts vd
CROSS JOIN profile_data pr
CROSS JOIN user_profile up
CROSS JOIN standard_groups_with_standards sg
CROSS JOIN user_has_rubric_access uhra
WHERE uhra.has_access = true

