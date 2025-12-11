-- Get video detail with departments, questions, options, and access control
-- Parameters: $1 = video_id (uuid), $2 = profile_id (uuid or "guest-profile-id")

WITH resolve_guest_profile AS (
    -- Resolve guest-profile-id using settings system (department-specific or default)
    SELECT 
        COALESCE(
            -- Department-specific settings guest profile (if user has departments)
            (SELECT sdg.profile_id FROM settings_default_guest sdg
             JOIN settings s ON s.id = sdg.settings_id AND s.active = true
             JOIN department_settings sd ON sd.settings_id = s.id AND sd.active = true
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
        vu.upload_id::text,
        COALESCE(vdd.department_ids, NULL) as department_ids,
        v.outline_agent_id::text,
        v.image_agent_id::text
    FROM videos v
    LEFT JOIN video_departments_data vdd ON vdd.video_id = v.id
    LEFT JOIN video_uploads vu ON vu.video_id = v.id AND vu.active = true
    CROSS JOIN video_department_access_check vdac
    WHERE v.id = $1 AND vdac.has_access = true
),
video_all_outlines AS (
    SELECT 
        vo.video_id,
        o.id::text as outline_id,
        o.name as outline_name,
        o.outline,
        o.created_at as outline_created_at,
        o.updated_at as outline_updated_at
    FROM video_outlines vo
    JOIN outlines o ON o.id = vo.outline_id
    WHERE vo.video_id = $1
),
video_outlines_agg AS (
    SELECT ARRAY_AGG(o.id::text ORDER BY vo.created_at) as outline_ids
    FROM video_outlines vo
    JOIN outlines o ON o.id = vo.outline_id
    WHERE vo.video_id = $1 AND vo.active = true
),
outline_mapping_data AS (
    SELECT 
        COALESCE(
            jsonb_object_agg(
                vao.outline_id,
                jsonb_build_object(
                    'name', vao.outline_name,
                    'outline', vao.outline,
                    'created_at', vao.outline_created_at::text,
                    'updated_at', vao.outline_updated_at::text
                )
            ),
            '{}'::jsonb
        ) as outline_mapping
    FROM video_all_outlines vao
),
video_documents_agg AS (
    SELECT ARRAY_AGG(document_id::text ORDER BY vd.created_at) as document_ids
    FROM video_documents vd
    WHERE vd.video_id = $1 AND vd.active = true
),
-- Document parameter relationships: direct (parameter_documents) and via fields (document_fields → parameter_fields)
document_parameter_relationships AS (
    SELECT DISTINCT
        d.id as document_id,
        param.id as parameter_id
    FROM video_documents vd
    JOIN documents d ON d.id = vd.document_id
    CROSS JOIN parameters param
    WHERE vd.video_id = $1 AND vd.active = true AND d.active = true AND param.active = true
        -- Exclude documents with scenario_parameter = true
        AND NOT EXISTS (
            SELECT 1 
            FROM document_fields df2
            JOIN parameter_fields pfield ON pfield.field_id = df2.field_id
            JOIN parameters param2 ON param2.id = pfield.parameter_id
            WHERE df2.document_id = d.id
            AND df2.active = true
            AND pfield.active = true
            AND param2.active = true
            AND param2.scenario_parameter = true
        )
    AND (
        -- Direct relationship via parameter_documents
        EXISTS (
            SELECT 1 FROM parameter_documents pd
            WHERE pd.document_id = d.id
            AND pd.parameter_id = param.id
            AND pd.active = true
        )
        OR
        -- Indirect relationship via document_fields → parameter_fields
        EXISTS (
            SELECT 1 FROM document_fields df
            JOIN parameter_fields pfield ON pfield.field_id = df.field_id
            WHERE df.document_id = d.id
            AND pfield.parameter_id = param.id
            AND df.active = true
            AND pfield.active = true
        )
        OR
        -- No restrictions: if parameter has no document restrictions, it's valid for all documents
        NOT EXISTS (
            SELECT 1 FROM parameter_documents pd2
            WHERE pd2.parameter_id = param.id
            AND pd2.active = true
        )
    )
),
document_mapping_data AS (
    SELECT COALESCE(
        jsonb_object_agg(
            d.id::text,
            jsonb_build_object(
                'name', d.name,
                'description', '',
                'extension', CASE 
                    WHEN u.file_path IS NOT NULL THEN SUBSTRING(u.file_path FROM '\.([^\.]+)$')
                    ELSE NULL
                END,
                'filePath', u.file_path,
                'mimeType', u.mime_type,
                'uploadId', CASE WHEN du.upload_id IS NOT NULL THEN du.upload_id::text ELSE NULL END,
                'parameter_ids', COALESCE(
                    (SELECT jsonb_agg(dpr.parameter_id::text ORDER BY dpr.parameter_id)
                     FROM document_parameter_relationships dpr
                     WHERE dpr.document_id = d.id),
                    '[]'::jsonb
                ),
                'field_ids', COALESCE(
                    (SELECT jsonb_agg(df.field_id::text ORDER BY df.field_id)
                     FROM document_fields df
                     WHERE df.document_id = d.id AND df.active = true),
                    '[]'::jsonb
                ),
                'parent_document_id', (
                    SELECT dt.parent_id::text
                    FROM document_tree dt
                    WHERE dt.child_id = d.id AND dt.active = true
                    LIMIT 1
                )
            )
        ) FILTER (WHERE d.id IS NOT NULL),
        '{}'::jsonb
    ) as mapping
    FROM video_documents vd
    JOIN documents d ON d.id = vd.document_id
    LEFT JOIN document_uploads du ON du.document_id = d.id AND du.active = true
    LEFT JOIN uploads u ON u.id = du.upload_id
    WHERE vd.video_id = $1 AND vd.active = true AND d.active = true
        -- Exclude documents with scenario_parameter = true
        AND NOT EXISTS (
            SELECT 1 
            FROM document_fields df2
            JOIN parameter_fields pfield ON pfield.field_id = df2.field_id
            JOIN parameters param ON param.id = pfield.parameter_id
            WHERE df2.document_id = d.id
            AND df2.active = true
            AND pfield.active = true
            AND param.active = true
            AND param.scenario_parameter = true
        )
),
valid_documents_filtered AS (
    SELECT DISTINCT
        d.id,
        d.name,
        ''::text as description,
        u.file_path,
        u.mime_type
    FROM documents d
    LEFT JOIN document_uploads du ON du.document_id = d.id AND du.active = true
    LEFT JOIN uploads u ON u.id = du.upload_id
    LEFT JOIN document_departments dd ON dd.document_id = d.id AND dd.active = true
    CROSS JOIN user_departments ud
    WHERE d.active = true
    GROUP BY d.id, d.name, u.file_path, u.mime_type
    HAVING 
        (
            COUNT(dd.document_id) FILTER (WHERE dd.department_id = ANY(ud.dept_ids)) > 0
            OR NOT EXISTS (SELECT 1 FROM document_departments dd2 WHERE dd2.document_id = d.id AND dd2.active = true)
        )
        -- Exclude documents with scenario_parameter = true
        AND NOT EXISTS (
            SELECT 1 
            FROM document_fields df
            JOIN parameter_fields pfield ON pfield.field_id = df.field_id
            JOIN parameters param ON param.id = pfield.parameter_id
            WHERE df.document_id = d.id
            AND df.active = true
            AND pfield.active = true
            AND param.active = true
            AND param.scenario_parameter = true
        )
),
-- Document parameter relationships for valid documents
valid_document_parameter_relationships AS (
    SELECT DISTINCT
        d.id as document_id,
        param.id as parameter_id
    FROM valid_documents_filtered d
    CROSS JOIN parameters param
    WHERE param.active = true
    AND (
        -- Direct relationship via parameter_documents
        EXISTS (
            SELECT 1 FROM parameter_documents pd
            WHERE pd.document_id = d.id
            AND pd.parameter_id = param.id
            AND pd.active = true
        )
        OR
        -- Indirect relationship via document_fields → parameter_fields
        EXISTS (
            SELECT 1 FROM document_fields df
            JOIN parameter_fields pfield ON pfield.field_id = df.field_id
            WHERE df.document_id = d.id
            AND pfield.parameter_id = param.id
            AND df.active = true
            AND pfield.active = true
        )
        OR
        -- No restrictions: if parameter has no document restrictions, it's valid for all documents
        NOT EXISTS (
            SELECT 1 FROM parameter_documents pd2
            WHERE pd2.parameter_id = param.id
            AND pd2.active = true
        )
    )
),
valid_documents_data AS (
    SELECT 
        COALESCE(ARRAY_AGG(d.id::text ORDER BY d.id), ARRAY[]::text[]) as document_ids,
        COALESCE(jsonb_object_agg(
            d.id::text,
            jsonb_build_object(
                'name', d.name,
                'description', d.description,
                'filePath', d.file_path,
                'mimeType', d.mime_type,
                'parameter_ids', COALESCE(
                    (SELECT jsonb_agg(vdpr.parameter_id::text ORDER BY vdpr.parameter_id)
                     FROM valid_document_parameter_relationships vdpr
                     WHERE vdpr.document_id = d.id),
                    '[]'::jsonb
                ),
                'field_ids', COALESCE(
                    (SELECT jsonb_agg(df.field_id::text ORDER BY df.field_id)
                     FROM document_fields df
                     WHERE df.document_id = d.id AND df.active = true),
                    '[]'::jsonb
                ),
                'parent_document_id', (
                    SELECT dt.parent_id::text
                    FROM document_tree dt
                    WHERE dt.child_id = d.id AND dt.active = true
                    LIMIT 1
                )
            )
        ), '{}'::jsonb) as document_mapping
    FROM valid_documents_filtered d
),
valid_documents AS (
    SELECT document_ids FROM valid_documents_data
),
document_details_data AS (
    SELECT COALESCE(
        (
            SELECT jsonb_agg(
                jsonb_build_object(
                    'document_id', d.id::text,
                    'name', d.name,
                    'updatedAt', d.updated_at::text,
                    'extension', CASE WHEN u.file_path IS NOT NULL THEN SUBSTRING(u.file_path FROM '\.([^\.]+)$') ELSE NULL END,
                    'scenario_ids', '[]'::jsonb,
                    'can_edit', true,
                    'can_delete', true,
                    'active', d.active,
                    'file_path', u.file_path,
                    'mime_type', u.mime_type,
                    'upload_id', u.id::text,
                    'parameter_item_ids', COALESCE((
                        SELECT jsonb_agg(df.field_id::text)
                        FROM document_fields df
                        WHERE df.document_id = d.id AND df.active = true
                    ), '[]'::jsonb),
                    'is_template', CASE 
                        WHEN d.template = true THEN true
                        WHEN EXISTS(
                            SELECT 1 FROM document_templates dt2 
                            WHERE dt2.document_id = d.id AND dt2.active = true
                        ) THEN true
                        ELSE false
                    END
                ) ORDER BY d.name
            )
            FROM video_documents vd
            JOIN documents d ON d.id = vd.document_id
            LEFT JOIN document_uploads du ON du.document_id = d.id AND du.active = true
            LEFT JOIN uploads u ON u.id = du.upload_id
            WHERE vd.video_id = $1 AND vd.active = true AND d.active = true
        ),
        '[]'::jsonb
    ) as document_details
),
video_images_data AS (
    SELECT COALESCE(
        jsonb_agg(
            jsonb_build_object(
                'id', vi.upload_id::text,
                'name', vi.name,
                'upload_id', vi.upload_id::text,
                'active', vi.active
            )
        ) FILTER (WHERE vi.upload_id IS NOT NULL),
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
            WHEN up.role IN ('admin', 'instructional', 'superadmin') THEN true
            ELSE false
        END as can_edit,
        CASE 
            WHEN up.role IN ('admin', 'instructional', 'superadmin') THEN true
            ELSE false
        END as can_delete,
        true as can_duplicate
    FROM video_core vc
    CROSS JOIN user_profile up
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
-- Objectives (shared between scenarios) for history
objectives_data AS (
    SELECT DISTINCT
        o.id,
        o.objective
    FROM objectives o
    LEFT JOIN scenario_objectives so ON so.objective_id = o.id
    LEFT JOIN scenario_departments sd ON sd.scenario_id = so.scenario_id AND sd.active = true
    CROSS JOIN user_profile up
    WHERE (
        up.role = 'superadmin'
        OR sd.department_id IN (SELECT department_id FROM resolve_profile_id rpi JOIN profile_departments pd ON pd.profile_id = rpi.resolved_profile_id WHERE pd.active = true)
        OR (NOT EXISTS (SELECT 1 FROM scenario_departments sd2 WHERE sd2.scenario_id = so.scenario_id AND sd2.active = true))
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
        q.allow_multiple,
        (SELECT ARRAY_AGG(distinct_times.time ORDER BY distinct_times.time) FROM (SELECT DISTINCT qt.time FROM question_times qt WHERE qt.video_id = vq.video_id AND qt.question_id = q.id AND qt.active = true) distinct_times) as times,
        -- All options for this question
        COALESCE(
            (SELECT jsonb_agg(option_obj ORDER BY (option_obj->>'option_id'))
             FROM (
                 SELECT DISTINCT ON (o2.id) jsonb_build_object(
                     'option_id', o2.id::text,
                     'option_text', o2.option_text,
                     'type', o2.type::text,
                     'is_correct', CASE WHEN qa2.option_id IS NOT NULL THEN true ELSE false END
                 ) as option_obj
                 FROM question_options qo2
                 LEFT JOIN options o2 ON o2.id = qo2.option_id AND o2.active = true
                 LEFT JOIN question_answers qa2 ON qa2.question_id = q.id AND qa2.option_id = o2.id AND qa2.active = true
                 WHERE qo2.question_id = q.id AND qo2.active = true AND o2.id IS NOT NULL
                 ORDER BY o2.id
             ) distinct_options
            ),
            '[]'::jsonb
        ) as options
    FROM video_questions vq
    JOIN questions q ON q.id = vq.question_id
    WHERE vq.video_id = $1 AND vq.active = true AND q.active = true
    GROUP BY q.id, q.question_text, q.allow_multiple, vq.video_id
),
questions_json AS (
    SELECT COALESCE(
        jsonb_agg(
            jsonb_build_object(
                'question_id', question_id::text,
                'question_text', question_text,
                'type', 'choice'::text,
                'allow_multiple', allow_multiple,
                'times', times,
                'options', options
            )
        ),
        '[]'::jsonb
    ) as questions
    FROM video_questions_data
),
valid_agents AS (
    -- Get agents with roles 'outline' or 'image'
    -- Filter by department access: include if has matching department link OR has no department links at all (cross-dept)
    SELECT 
        COALESCE(
            jsonb_object_agg(
                a.id::text,
                jsonb_build_object(
                    'name', a.name,
                    'description', COALESCE(a.description, ''),
                    'roles', ARRAY[a.role::text]
                )
            ),
            '{}'::jsonb
        ) as agent_mapping,
        COALESCE(array_agg(a.id::text ORDER BY a.name), ARRAY[]::text[]) as agent_ids
    FROM agents a
    LEFT JOIN agent_departments ad ON ad.agent_id = a.id AND ad.active = true
    WHERE a.active = true 
    AND a.role IN ('outline', 'image')
    AND (
        EXISTS (
            SELECT 1 FROM resolve_profile_id rpi 
            JOIN profile_departments pd ON pd.profile_id = rpi.resolved_profile_id 
            WHERE pd.active = true AND ad.department_id = pd.department_id
        )
        OR NOT EXISTS (SELECT 1 FROM agent_departments ad2 WHERE ad2.agent_id = a.id AND ad2.active = true)
    )
),
-- Video parameters (filtered by video_parameters junction table OR parameter_documents junction table)
linked_video_parameters AS (
    -- Get parameters linked to this video via video_parameters junction table
    SELECT DISTINCT
        p.id,
        p.name,
        COALESCE(p.description, '') as description,
        CASE WHEN EXISTS (SELECT 1 FROM parameter_documents pd WHERE pd.parameter_id = p.id AND pd.active = true) THEN true ELSE false END as document_parameter,
        CASE WHEN EXISTS (SELECT 1 FROM video_parameters vp WHERE vp.parameter_id = p.id AND vp.active = true) THEN true ELSE false END as video_parameter
    FROM video_parameters vp
    JOIN parameters p ON p.id = vp.parameter_id
    WHERE vp.video_id = $1
    AND vp.active = true
    AND p.active = true
),
document_parameters_for_video AS (
    -- Also include parameters linked via parameter_documents (for document filtering)
    SELECT DISTINCT
        p.id,
        p.name,
        COALESCE(p.description, '') as description,
        true as document_parameter,
        false as video_parameter
    FROM parameter_documents pd
    JOIN parameters p ON p.id = pd.parameter_id
    WHERE pd.active = true
    AND p.active = true
),
video_parameter_data AS (
    SELECT * FROM linked_video_parameters
    UNION
    SELECT * FROM document_parameters_for_video
),
-- Get ALL parameters where video_parameter = true (filtered by department access) - like scenarios do
parameter_data_for_mapping AS (
    SELECT DISTINCT 
        p.id,
        p.name,
        COALESCE(p.description, '') as description,
        CASE WHEN EXISTS (SELECT 1 FROM parameter_documents pd WHERE pd.parameter_id = p.id AND pd.active = true) THEN true ELSE false END as document_parameter,
        CASE WHEN EXISTS (SELECT 1 FROM video_parameters vp WHERE vp.parameter_id = p.id AND vp.active = true) THEN true ELSE false END as video_parameter
    FROM parameters p
    JOIN parameter_fields fp ON fp.parameter_id = p.id AND fp.active = true
    LEFT JOIN field_departments fd ON fd.field_id = fp.field_id AND fd.active = true
    CROSS JOIN user_departments ud
    WHERE p.active = true
    AND p.video_parameter = true
    GROUP BY p.id, p.name, p.description
    HAVING 
        COUNT(fd.field_id) FILTER (WHERE fd.department_id = ANY(ud.dept_ids)) > 0
        OR NOT EXISTS (SELECT 1 FROM field_departments fd2 
                      JOIN parameter_fields fp2 ON fp2.field_id = fd2.field_id 
                      WHERE fp2.parameter_id = p.id AND fp2.active = true)
    ORDER BY p.name
),
parameter_mapping_data AS (
    SELECT 
        COALESCE(jsonb_object_agg(
            p.id::text,
            jsonb_build_object(
                'name', p.name, 
                'description', p.description, 
                'document_parameter', p.document_parameter,
                'video_parameter', p.video_parameter
            )
        ), '{}'::jsonb) as parameter_mapping
    FROM parameter_data_for_mapping p
),
video_parameter_mapping_data AS (
    SELECT 
        COALESCE(jsonb_object_agg(
            p.id::text,
            jsonb_build_object(
                'name', p.name, 
                'description', p.description, 
                'document_parameter', p.document_parameter,
                'video_parameter', p.video_parameter
            )
        ), '{}'::jsonb) as parameter_mapping
    FROM video_parameter_data p
),
enhanced_parameter_mapping_data AS (
    SELECT 
        COALESCE(
            (
                SELECT jsonb_object_agg(key, value)
                FROM (
                    SELECT key, value 
                    FROM jsonb_each(pmd.parameter_mapping)
                    UNION ALL
                    SELECT key, value 
                    FROM jsonb_each(vpmd.parameter_mapping)
                ) combined
            ),
            '{}'::jsonb
        ) as parameter_mapping
    FROM parameter_mapping_data pmd
    CROSS JOIN video_parameter_mapping_data vpmd
),
video_parameter_items_data AS (
    SELECT DISTINCT
        pi.id,
        pi.name,
        COALESCE(pi.description, '') as description,
        fp.parameter_id,
        p.name as parameter_name
    FROM (
        SELECT id FROM parameter_data_for_mapping
        UNION
        SELECT id FROM document_parameters_for_video
    ) all_params
    JOIN parameter_fields fp ON fp.parameter_id = all_params.id AND fp.active = true
    JOIN fields pi ON pi.id = fp.field_id
    JOIN parameters p ON p.id = fp.parameter_id
    LEFT JOIN field_departments fd ON fd.field_id = pi.id AND fd.active = true
    CROSS JOIN user_departments ud
    WHERE p.active = true AND pi.active = true
    GROUP BY pi.id, pi.name, pi.description, fp.parameter_id, p.id, p.name
    HAVING 
        COUNT(fd.field_id) FILTER (WHERE fd.department_id = ANY(ud.dept_ids)) > 0
        OR NOT EXISTS (SELECT 1 FROM field_departments fd2 WHERE fd2.field_id = pi.id AND fd2.active = true)
    ORDER BY p.name, pi.name
),
video_field_mapping_data AS (
    SELECT 
        COALESCE(jsonb_object_agg(
            pi.id::text,
            jsonb_build_object(
                'name', pi.name,
                'description', pi.description,
                'parameter_id', pi.parameter_id::text,
                'parameter_name', pi.parameter_name
            )
        ), '{}'::jsonb) as field_mapping
    FROM video_parameter_items_data pi
),
video_selected_parameter_items AS (
    SELECT ARRAY_AGG(vf.field_id::text ORDER BY vf.field_id) as parameter_item_ids
    FROM video_fields vf
    WHERE vf.video_id = $1 AND vf.active = true
),
video_personas_agg AS (
    SELECT ARRAY_AGG(vp.persona_id::text ORDER BY vp.persona_id) as persona_ids
    FROM video_personas vp
    WHERE vp.video_id = $1 AND vp.active = true
),
image_model_check AS (
    SELECT 
        model_id,
        CASE WHEN COUNT(*) > 0 THEN true ELSE false END as image_model
    FROM model_modalities
    WHERE modality = 'image' AND is_input = false AND active = true
    GROUP BY model_id
),
valid_personas_filtered AS (
    SELECT DISTINCT
        p.id,
        p.name,
        COALESCE(p.description, '') as description,
        p.color,
        p.icon,
        COALESCE(imc.image_model, false) as image_model
    FROM personas p
    LEFT JOIN persona_voice_agents pva ON pva.persona_id = p.id AND pva.active = true
    LEFT JOIN agents a ON a.id = pva.agent_id
    LEFT JOIN models m ON m.id = a.model_id
    LEFT JOIN image_model_check imc ON imc.model_id = m.id
    LEFT JOIN persona_departments pd ON pd.persona_id = p.id AND pd.active = true
    CROSS JOIN user_departments ud
    WHERE p.active = true
    GROUP BY p.id, p.name, p.description, p.color, p.icon, imc.image_model
    HAVING 
        (
            COUNT(pd.persona_id) FILTER (WHERE pd.department_id = ANY(ud.dept_ids)) > 0
            OR NOT EXISTS (SELECT 1 FROM persona_departments pd2 WHERE pd2.persona_id = p.id AND pd2.active = true)
        )
        -- Exclude personas with scenario_parameter = true (matching scenarios pattern which excludes video_parameter)
        AND NOT EXISTS (
            SELECT 1 
            FROM persona_fields pf
            JOIN parameter_fields pfield ON pfield.field_id = pf.field_id
            JOIN parameters param ON param.id = pfield.parameter_id
            WHERE pf.persona_id = p.id
            AND pf.active = true
            AND pfield.active = true
            AND param.active = true
            AND param.scenario_parameter = true
        )
),
persona_data AS (
    SELECT * FROM valid_personas_filtered
    UNION
    SELECT DISTINCT
        p2.id,
        p2.name,
        COALESCE(p2.description, '') as description,
        p2.color,
        p2.icon,
        COALESCE(imc2.image_model, false) as image_model
    FROM video_personas_agg vpa
    CROSS JOIN LATERAL unnest(vpa.persona_ids) as persona_id
    JOIN personas p2 ON p2.id = persona_id::uuid
    LEFT JOIN persona_voice_agents pva2 ON pva2.persona_id = p2.id AND pva2.active = true
    LEFT JOIN agents a2 ON a2.id = pva2.agent_id
    LEFT JOIN models m2 ON m2.id = a2.model_id
    LEFT JOIN image_model_check imc2 ON imc2.model_id = m2.id
    WHERE p2.active = true
    ORDER BY name
),
-- Persona parameter relationships: direct (parameter_personas) and via fields (persona_fields → parameter_fields)
persona_parameter_relationships AS (
    SELECT DISTINCT
        p.id as persona_id,
        param.id as parameter_id
    FROM persona_data p
    CROSS JOIN parameters param
    WHERE param.active = true
    AND (
        -- Direct relationship via parameter_personas
        EXISTS (
            SELECT 1 FROM parameter_personas pp
            WHERE pp.persona_id = p.id
            AND pp.parameter_id = param.id
            AND pp.active = true
        )
        OR
        -- Indirect relationship via persona_fields → parameter_fields
        EXISTS (
            SELECT 1 FROM persona_fields pf
            JOIN parameter_fields pfield ON pfield.field_id = pf.field_id
            WHERE pf.persona_id = p.id
            AND pfield.parameter_id = param.id
            AND pf.active = true
            AND pfield.active = true
        )
        OR
        -- No restrictions: if parameter has no persona restrictions, it's valid for all personas
        NOT EXISTS (
            SELECT 1 FROM parameter_personas pp2
            WHERE pp2.parameter_id = param.id
            AND pp2.active = true
        )
    )
),
valid_personas_data AS (
    SELECT 
        COALESCE(ARRAY_AGG(p.id::text ORDER BY p.name), ARRAY[]::text[]) as valid_persona_ids,
        COALESCE(jsonb_object_agg(
            p.id::text,
            jsonb_build_object(
                'name', p.name,
                'description', p.description,
                'color', p.color,
                'icon', p.icon,
                'image_model', COALESCE(p.image_model, false),
                'parameter_ids', COALESCE(
                    (SELECT jsonb_agg(ppr.parameter_id::text ORDER BY ppr.parameter_id)
                     FROM persona_parameter_relationships ppr
                     WHERE ppr.persona_id = p.id),
                    '[]'::jsonb
                ),
                'field_ids', COALESCE(
                    (SELECT jsonb_agg(pf.field_id::text ORDER BY pf.field_id)
                     FROM persona_fields pf
                     WHERE pf.persona_id = p.id AND pf.active = true),
                    '[]'::jsonb
                )
            )
        ), '{}'::jsonb) as persona_mapping
    FROM persona_data p
),
video_personas_data AS (
    SELECT 
        COALESCE((SELECT persona_ids FROM video_personas_agg), ARRAY[]::text[]) as persona_ids,
        COALESCE((SELECT persona_mapping FROM valid_personas_data), '{}'::jsonb) as persona_mapping
)
SELECT 
    vc.name,
    vc.length_seconds,
    vc.active,
    vc.upload_id,
    vc.department_ids,
    COALESCE((SELECT department_ids FROM valid_departments), ARRAY[]::text[]) as valid_department_ids,
    COALESCE((SELECT outline_ids FROM video_outlines_agg), ARRAY[]::text[]) as outline_ids,
    COALESCE((SELECT outline_mapping FROM outline_mapping_data), '{}'::jsonb) as outline_mapping,
    COALESCE((SELECT document_ids FROM video_documents_agg), ARRAY[]::text[]) as document_ids,
    COALESCE(
        (
            SELECT jsonb_object_agg(key, value)
            FROM (
                SELECT key, value 
                FROM jsonb_each((SELECT mapping FROM document_mapping_data))
                UNION ALL
                SELECT key, value 
                FROM jsonb_each((SELECT document_mapping FROM valid_documents_data))
            ) combined
        ),
        '{}'::jsonb
    ) as document_mapping,
    COALESCE((SELECT document_ids FROM valid_documents_data), ARRAY[]::text[]) as valid_document_ids,
    COALESCE((SELECT document_details FROM document_details_data), '[]'::jsonb) as document_details,
    COALESCE((SELECT video_images FROM video_images_data), '[]'::jsonb) as video_images,
    COALESCE((SELECT objectives_history FROM objectives_history_data), ARRAY[]::text[]) as objectives_history,
    vp.can_edit,
    vp.can_duplicate,
    vp.can_delete,
    COALESCE((SELECT mapping FROM department_mapping_data), '{}'::jsonb) as department_mapping,
    COALESCE((SELECT questions FROM questions_json), '[]'::jsonb) as questions,
    vc.outline_agent_id,
    vc.image_agent_id,
    COALESCE(va.agent_mapping, '{}'::jsonb) as agent_mapping,
    COALESCE(va.agent_ids, ARRAY[]::text[]) as valid_agent_ids,
    COALESCE((SELECT parameter_mapping FROM enhanced_parameter_mapping_data), '{}'::jsonb) as parameter_mapping,
    COALESCE((SELECT array_agg(id::text) FROM parameter_data_for_mapping), ARRAY[]::text[]) as parameter_ids,
    COALESCE((SELECT field_mapping FROM video_field_mapping_data), '{}'::jsonb) as field_mapping,
    COALESCE((SELECT parameter_item_ids FROM video_selected_parameter_items), ARRAY[]::text[]) as parameter_item_ids,
    COALESCE((SELECT persona_ids FROM video_personas_data), ARRAY[]::text[]) as persona_ids,
    COALESCE((SELECT persona_mapping FROM video_personas_data), '{}'::jsonb) as persona_mapping,
    COALESCE((SELECT valid_persona_ids FROM valid_personas_data), ARRAY[]::text[]) as valid_persona_ids
FROM video_core vc
CROSS JOIN video_permissions vp
CROSS JOIN valid_agents va
WHERE vc.id = $1

