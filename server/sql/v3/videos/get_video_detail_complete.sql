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
        v.length_seconds,
        v.active,
        COALESCE(vdd.department_ids, NULL) as department_ids
    FROM videos v
    LEFT JOIN video_departments_data vdd ON vdd.video_id = v.id
    CROSS JOIN video_department_access_check vdac
    WHERE v.id = $1 AND vdac.has_access = true
),
video_all_problem_statements AS (
    SELECT 
        vps.video_id,
        ps.id::text as problem_statement_id,
        ps.problem_statement,
        ps.created_at as problem_statement_created_at,
        ps.updated_at as problem_statement_updated_at
    FROM video_problem_statements vps
    JOIN problem_statements ps ON ps.id = vps.problem_statement_id
    WHERE vps.video_id = $1
),
video_problem_statements_agg AS (
    SELECT ARRAY_AGG(ps.id::text ORDER BY vps.created_at) as problem_statement_ids
    FROM video_problem_statements vps
    JOIN problem_statements ps ON ps.id = vps.problem_statement_id
    WHERE vps.video_id = $1 AND vps.active = true
),
problem_statement_mapping_data AS (
    SELECT 
        COALESCE(
            jsonb_object_agg(
                vaps.problem_statement_id,
                jsonb_build_object(
                    'problem_statement', vaps.problem_statement,
                    'created_at', vaps.problem_statement_created_at::text,
                    'updated_at', vaps.problem_statement_updated_at::text
                )
            ),
            '{}'::jsonb
        ) as problem_statement_mapping
    FROM video_all_problem_statements vaps
),
video_objectives_agg AS (
    SELECT 
        ARRAY_AGG(o.id::text ORDER BY vo.idx) as objective_ids,
        COALESCE(jsonb_object_agg(
            o.id::text,
            jsonb_build_object('name', o.objective, 'description', o.objective)
        ) FILTER (WHERE o.objective IS NOT NULL), '{}'::jsonb) as objective_mapping
    FROM video_objectives vo
    JOIN objectives o ON o.id = vo.objective_id
    WHERE vo.video_id = $1
),
video_policies_agg AS (
    SELECT ARRAY_AGG(policy_id::text ORDER BY vp.created_at) as policy_ids
    FROM video_policies vp
    WHERE vp.video_id = $1 AND vp.active = true
),
policy_mapping_data AS (
    SELECT COALESCE(
        jsonb_object_agg(
            p.id::text,
            jsonb_build_object(
                'name', p.name,
                'description', COALESCE(p.description, ''),
                'extension', SUBSTRING(p.file_path FROM '\.([^\.]+)$'),
                'filePath', p.file_path,
                'mimeType', p.mime_type
            )
        ) FILTER (WHERE p.id IS NOT NULL),
        '{}'::jsonb
    ) as mapping
    FROM video_policies vp
    JOIN policies p ON p.id = vp.policy_id
    WHERE vp.video_id = $1 AND vp.active = true AND p.active = true
),
valid_policies AS (
    SELECT ARRAY_AGG(DISTINCT p.id::text ORDER BY p.id) as policy_ids
    FROM policies p
    CROSS JOIN user_profile up
    LEFT JOIN policy_departments pd ON pd.policy_id = p.id AND pd.active = true
    WHERE p.active = true
        AND (
            up.role = 'superadmin'
            OR pd.department_id IN (SELECT department_id FROM resolve_profile_id rpi JOIN profile_departments pd2 ON pd2.profile_id = rpi.resolved_profile_id WHERE pd2.active = true)
            OR NOT EXISTS (SELECT 1 FROM policy_departments pd3 WHERE pd3.policy_id = p.id AND pd3.active = true)
        )
),
video_images_data AS (
    SELECT COALESCE(
        jsonb_agg(
            jsonb_build_object(
                'id', vi.id::text,
                'file_path', vi.file_path,
                'mime_type', vi.mime_type,
                'active', vi.active
            )
        ) FILTER (WHERE vi.id IS NOT NULL),
        '[]'::jsonb
    ) as video_images
    FROM video_images vi
    WHERE vi.video_id = $1 AND vi.active = true
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
    SELECT ARRAY_AGG(d.id::text ORDER BY d.id) as department_ids
    FROM (SELECT DISTINCT d.id FROM departments d WHERE d.id IN (SELECT department_id FROM resolve_profile_id rpi JOIN profile_departments pd ON pd.profile_id = rpi.resolved_profile_id WHERE pd.active = true)) d
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
-- Objectives (shared between scenarios and videos) for history
objectives_data AS (
    SELECT DISTINCT
        o.id,
        o.objective
    FROM objectives o
    LEFT JOIN scenario_objectives so ON so.objective_id = o.id
    LEFT JOIN scenario_departments sd ON sd.scenario_id = so.scenario_id AND sd.active = true
    LEFT JOIN video_objectives vo ON vo.objective_id = o.id
    LEFT JOIN video_departments vd ON vd.video_id = vo.video_id AND vd.active = true
    CROSS JOIN user_profile up
    WHERE (
        up.role = 'superadmin'
        OR sd.department_id IN (SELECT department_id FROM resolve_profile_id rpi JOIN profile_departments pd ON pd.profile_id = rpi.resolved_profile_id WHERE pd.active = true)
        OR vd.department_id IN (SELECT department_id FROM resolve_profile_id rpi JOIN profile_departments pd ON pd.profile_id = rpi.resolved_profile_id WHERE pd.active = true)
        OR (NOT EXISTS (SELECT 1 FROM scenario_departments sd2 WHERE sd2.scenario_id = so.scenario_id AND sd2.active = true)
            AND NOT EXISTS (SELECT 1 FROM video_departments vd2 WHERE vd2.video_id = vo.video_id AND vd2.active = true))
    )
),
objectives_history_data AS (
    SELECT ARRAY_AGG(o.objective ORDER BY o.id) as objectives_history
    FROM objectives_data o
),
-- Questions with their times, options, and correct answers
video_questions_data AS (
    SELECT 
        q.id as question_id,
        q.question_text,
        q.type as question_type,
        q.allow_multiple,
        (SELECT ARRAY_AGG(time ORDER BY time) FROM (SELECT DISTINCT qt.time FROM question_times qt WHERE qt.video_id = vq.video_id AND qt.question_id = q.id AND qt.active = true) distinct_times) as times,
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
    LEFT JOIN question_options qo ON qo.question_id = q.id AND qo.active = true
    LEFT JOIN options o ON o.id = qo.option_id AND o.active = true
    LEFT JOIN question_answers qa ON qa.question_id = q.id AND qa.option_id = o.id AND qa.active = true
    WHERE vq.video_id = $1 AND vq.active = true AND q.active = true
    GROUP BY q.id, q.question_text, q.type, q.allow_multiple, vq.video_id
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
    vc.length_seconds,
    vc.active,
    vc.department_ids,
    COALESCE((SELECT department_ids FROM valid_departments), ARRAY[]::text[]) as valid_department_ids,
    COALESCE((SELECT problem_statement_ids FROM video_problem_statements_agg), ARRAY[]::text[]) as problem_statement_ids,
    COALESCE((SELECT problem_statement_mapping FROM problem_statement_mapping_data), '{}'::jsonb) as problem_statement_mapping,
    COALESCE((SELECT objective_ids FROM video_objectives_agg), ARRAY[]::text[]) as objective_ids,
    COALESCE((SELECT objective_mapping FROM video_objectives_agg), '{}'::jsonb) as objective_mapping,
    COALESCE((SELECT policy_ids FROM video_policies_agg), ARRAY[]::text[]) as policy_ids,
    COALESCE((SELECT mapping FROM policy_mapping_data), '{}'::jsonb) as policy_mapping,
    COALESCE((SELECT policy_ids FROM valid_policies), ARRAY[]::text[]) as valid_policy_ids,
    COALESCE((SELECT video_images FROM video_images_data), '[]'::jsonb) as video_images,
    COALESCE((SELECT objectives_history FROM objectives_history_data), ARRAY[]::text[]) as objectives_history,
    vp.can_edit,
    vp.can_duplicate,
    vp.can_delete,
    COALESCE((SELECT mapping FROM department_mapping_data), '{}'::jsonb) as department_mapping,
    COALESCE((SELECT questions FROM questions_json), '[]'::jsonb) as questions
FROM video_core vc
CROSS JOIN video_permissions vp
WHERE vc.id = $1

