-- Get default rubric detail for creation
-- Parameters: $1 = profile_id (uuid or "guest-profile-id")

WITH resolve_guest_profile AS (
    -- Resolve guest-profile-id using settings system (department-specific or default)
    SELECT 
        COALESCE(
            -- Department-specific settings guest profile (if user has departments)
            (SELECT sdg.profile_id FROM settings_default_guest sdg
             JOIN settings s ON s.id = sdg.settings_id AND s.active = true
             JOIN department_settings sd ON sd.settings_id = s.id AND sd.active = true
             JOIN profile_departments pd ON pd.department_id = sd.department_id AND pd.active = true
             WHERE pd.profile_id = $1::uuid AND sdg.active = true
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
            WHEN $1::text = 'guest-profile-id' THEN
                (SELECT guest_profile_id FROM resolve_guest_profile)
            WHEN $1::text IS NULL OR $1::text = '' THEN NULL::uuid
            ELSE $1::uuid
        END as resolved_profile_id
),
user_departments AS (
    SELECT DISTINCT pd.department_id
    FROM resolve_profile_id rpi
    JOIN profile_departments pd ON pd.profile_id = rpi.resolved_profile_id
    WHERE pd.active = true
),
default_rubric AS (
    SELECT r.id
    FROM rubrics r
    LEFT JOIN rubric_departments rd ON rd.rubric_id = r.id AND rd.active = true
    WHERE r.active = true
    GROUP BY r.id
    HAVING 
        COUNT(rd.rubric_id) FILTER (WHERE rd.department_id IN (SELECT department_id FROM user_departments)) > 0
        OR NOT EXISTS (SELECT 1 FROM rubric_departments rd2 WHERE rd2.rubric_id = r.id AND rd2.active = true)
    ORDER BY r.created_at DESC
    LIMIT 1
),
rubric_data AS (
    SELECT 
        r.name,
        r.description,
        r.active,
        r.points,
        r.pass_points as passpoints
    FROM rubrics r
    JOIN default_rubric dr ON r.id = dr.id
),
rubric_departments_data AS (
    SELECT 
        COALESCE(
            ARRAY_AGG(rd.department_id::text ORDER BY rd.created_at) FILTER (WHERE rd.department_id IS NOT NULL),
            ARRAY[]::text[]
        ) as department_ids
    FROM default_rubric dr
    LEFT JOIN rubric_departments rd ON rd.rubric_id = dr.id AND rd.active = true
    GROUP BY dr.id
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
primary_department_id AS (
    SELECT department_id::text
    FROM resolve_profile_id rpi
    JOIN profile_departments pd ON pd.profile_id = rpi.resolved_profile_id
    WHERE pd.is_primary = TRUE
    LIMIT 1
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
    JOIN default_rubric dr ON sg.rubric_id = dr.id
)
SELECT 
    r.*,
    COALESCE(rdd.department_ids, ARRAY[]::text[]) as department_ids,
    vd.dept_mapping as department_mapping,
    vd.dept_ids as valid_department_ids,
    pr.user_role,
    sg.groups_json as standard_groups_complete,
    pdi.department_id as primary_department_id
FROM rubric_data r
LEFT JOIN rubric_departments_data rdd ON true
CROSS JOIN valid_depts vd
CROSS JOIN profile_data pr
CROSS JOIN standard_groups_with_standards sg
LEFT JOIN primary_department_id pdi ON true

