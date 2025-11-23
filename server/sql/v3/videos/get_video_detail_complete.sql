-- Get video detail with departments, questions, options, and access control
-- Parameters: $1 = video_id (uuid), $2 = profile_id (uuid or "guest-profile-id")

WITH resolve_profile_id AS (
    SELECT 
        CASE 
            WHEN $2::text = 'guest-profile-id' THEN
                (SELECT id::uuid FROM profiles WHERE role = 'guest' AND default_profile = true ORDER BY created_at DESC LIMIT 1)
            WHEN $2::text IS NULL OR $2::text = '' THEN NULL::uuid
            ELSE $2::uuid
        END as resolved_profile_id
),
user_profile AS (
    SELECT role FROM resolve_profile_id rpi
    JOIN profiles p ON p.id = rpi.resolved_profile_id
),
user_departments AS (
    SELECT ARRAY_AGG(DISTINCT pd.department_id) as dept_ids
    FROM resolve_profile_id rpi
    JOIN profile_departments pd ON pd.profile_id = rpi.resolved_profile_id
    JOIN departments d ON d.id = pd.department_id
    WHERE pd.active = true AND d.active = true
),
video_departments_data AS (
    SELECT 
        vd.video_id,
        ARRAY_AGG(vd.department_id::text ORDER BY vd.created_at) as department_ids
    FROM video_departments vd
    WHERE vd.video_id = $1 AND vd.active = true
    GROUP BY vd.video_id
),
video_department_access_check AS (
    SELECT 
        v.id as video_id,
        CASE 
            WHEN up.role = 'superadmin' THEN true
            WHEN EXISTS (
                SELECT 1 FROM video_departments vd 
                WHERE vd.video_id = v.id 
                AND vd.active = true 
                AND vd.department_id IN (SELECT department_id FROM resolve_profile_id rpi JOIN profile_departments pd ON pd.profile_id = rpi.resolved_profile_id WHERE pd.active = true)
            ) THEN true
            WHEN NOT EXISTS (
                SELECT 1 FROM video_departments vd2 
                WHERE vd2.video_id = v.id 
                AND vd2.active = true
            ) THEN true  -- Cross-department resource
            ELSE false
        END as has_access
    FROM videos v
    CROSS JOIN user_profile up
    WHERE v.id = $1
),
video_core AS (
    SELECT 
        v.id,
        v.name,
        v.description,
        v.length_seconds,
        v.active,
        COALESCE(vdd.department_ids, NULL) as department_ids
    FROM videos v
    LEFT JOIN video_departments_data vdd ON vdd.video_id = v.id
    CROSS JOIN video_department_access_check vdac
    WHERE v.id = $1 AND vdac.has_access = true
),
video_all_simulation_links AS (
    SELECT 
        sv.video_id,
        COUNT(*) as total_links
    FROM simulation_videos sv
    WHERE sv.video_id = $1
    GROUP BY sv.video_id
),
video_permissions AS (
    SELECT 
        vc.id as video_id,
        CASE 
            WHEN COALESCE(vc.department_ids, NULL) IS NULL AND up.role != 'superadmin' THEN false
            WHEN up.role IN ('admin', 'instructional', 'superadmin') 
                 AND COALESCE(vasl.total_links, 0) = 0 
            THEN true
            ELSE false
        END as can_edit,
        CASE 
            WHEN COALESCE(vc.department_ids, NULL) IS NULL AND up.role != 'superadmin' THEN false
            WHEN up.role IN ('admin', 'instructional', 'superadmin') 
                 AND COALESCE(vasl.total_links, 0) = 0 
            THEN true
            ELSE false
        END as can_delete,
        true as can_duplicate
    FROM video_core vc
    CROSS JOIN user_profile up
    LEFT JOIN video_all_simulation_links vasl ON vasl.video_id = vc.id
),
valid_departments AS (
    SELECT ARRAY_AGG(DISTINCT d.id::text ORDER BY d.id) as department_ids
    FROM departments d
    WHERE d.id IN (SELECT department_id FROM resolve_profile_id rpi JOIN profile_departments pd ON pd.profile_id = rpi.resolved_profile_id WHERE pd.active = true)
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
    WHERE d.id IN (SELECT department_id FROM resolve_profile_id rpi JOIN profile_departments pd ON pd.profile_id = rpi.resolved_profile_id WHERE pd.active = true)
),
-- Questions with their times, options, and correct answers
video_questions_data AS (
    SELECT 
        q.id as question_id,
        q.question_text,
        q.type as question_type,
        q.allow_multiple,
        ARRAY_AGG(DISTINCT qt.time ORDER BY qt.time) FILTER (WHERE qt.active = true) as times,
        -- All options for this question
        COALESCE(
            jsonb_agg(
                DISTINCT jsonb_build_object(
                    'option_id', o.id::text,
                    'option_text', o.option_text,
                    'type', o.type::text,
                    'is_correct', CASE WHEN qa.option_id IS NOT NULL THEN true ELSE false END
                )
            ) FILTER (WHERE o.id IS NOT NULL),
            '[]'::jsonb
        ) as options
    FROM video_questions vq
    JOIN questions q ON q.id = vq.question_id
    LEFT JOIN question_times qt ON qt.video_id = vq.video_id AND qt.question_id = q.id AND qt.active = true
    LEFT JOIN question_options qo ON qo.question_id = q.id AND qo.active = true
    LEFT JOIN options o ON o.id = qo.option_id AND o.active = true
    LEFT JOIN question_answers qa ON qa.question_id = q.id AND qa.option_id = o.id AND qa.active = true
    WHERE vq.video_id = $1 AND vq.active = true AND q.active = true
    GROUP BY q.id, q.question_text, q.type, q.allow_multiple
),
questions_json AS (
    SELECT COALESCE(
        jsonb_agg(
            jsonb_build_object(
                'question_id', question_id::text,
                'question_text', question_text,
                'type', question_type::text,
                'allow_multiple', allow_multiple,
                'times', times,
                'options', options
            )
        ),
        '[]'::jsonb
    ) as questions
    FROM video_questions_data
)
SELECT 
    vc.name,
    vc.description,
    vc.length_seconds,
    vc.active,
    vc.department_ids,
    COALESCE((SELECT department_ids FROM valid_departments), ARRAY[]::text[]) as valid_department_ids,
    vp.can_edit,
    vp.can_duplicate,
    vp.can_delete,
    COALESCE((SELECT mapping FROM department_mapping_data), '{}'::jsonb) as department_mapping,
    COALESCE((SELECT questions FROM questions_json), '[]'::jsonb) as questions
FROM video_core vc
CROSS JOIN video_permissions vp
WHERE vc.id = $1

