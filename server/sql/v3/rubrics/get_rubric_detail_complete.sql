-- Get rubric detail with departments, standard groups, and access control
-- Parameters: $1 = rubric_id (uuid), $2 = profile_id (uuid or "guest-profile-id")

WITH resolve_guest_profile AS (
    -- Resolve guest-profile-id using settings system (department-specific or default)
    SELECT 
        COALESCE(
            -- Department-specific settings guest profile (if user has departments)
            (SELECT sdg.profile_id FROM settings_default_guest sdg
             JOIN settings s ON s.id = sdg.settings_id AND s.active = true
             JOIN settings_departments sd ON sd.settings_id = s.id AND sd.active = true
             JOIN profile_departments pd ON pd.department_id = sd.department_id AND pd.active = true
             WHERE pd.profile_id = $2::uuid AND sdg.active = true
             LIMIT 1),
            -- Fallback to default (active) settings guest profile
            (SELECT sdg.profile_id FROM settings_default_guest sdg
             JOIN settings s ON s.id = sdg.settings_id AND s.active = true
             WHERE sdg.active = true
             LIMIT 1)
        ) as guest_profile_id
),
resolve_profile_id AS (
    SELECT 
        CASE 
            WHEN $2::text = 'guest-profile-id' THEN
                (SELECT guest_profile_id FROM resolve_guest_profile)
            WHEN $2::text IS NULL OR $2::text = '' THEN NULL::uuid
            ELSE $2::uuid
        END as resolved_profile_id
),
rubric_data AS (
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
profile_data AS (
    SELECT role as user_role 
    FROM resolve_profile_id rpi
    JOIN profiles p ON p.id = rpi.resolved_profile_id
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
                ORDER BY sg.name
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
CROSS JOIN standard_groups_with_standards sg
CROSS JOIN user_has_rubric_access uhra
WHERE uhra.has_access = true

