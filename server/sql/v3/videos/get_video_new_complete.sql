WITH user_departments AS (
    SELECT department_id
    FROM profile_departments
    WHERE profile_id = $1 AND active = true
),
user_profile AS (
    SELECT 
        role,
        (SELECT department_id FROM profile_departments WHERE profile_id = $1 AND active = true LIMIT 1) as primary_department_id
    FROM profiles WHERE id = $1
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
    WHERE d.id IN (SELECT department_id FROM user_departments)
),
department_ids_array AS (
    SELECT ARRAY_AGG(department_id::text ORDER BY department_id) as department_ids
    FROM user_departments
),
-- Problem statements (shared between scenarios only - videos now use outlines)
problem_statement_data AS (
    SELECT DISTINCT
        ps.id,
        ps.problem_statement,
        ps.created_at,
        ps.updated_at
    FROM problem_statements ps
    LEFT JOIN scenario_problem_statements sps ON sps.problem_statement_id = ps.id
    LEFT JOIN scenario_departments sd ON sd.scenario_id = sps.scenario_id AND sd.active = true
    CROSS JOIN user_profile up
    WHERE (
        up.role = 'superadmin'
        OR sd.department_id IN (SELECT department_id FROM user_departments)
        OR NOT EXISTS (SELECT 1 FROM scenario_departments sd2 WHERE sd2.scenario_id = sps.scenario_id AND sd2.active = true)
    )
),
problem_statement_mapping_data AS (
    SELECT COALESCE(
        jsonb_object_agg(
            ps.id::text,
            jsonb_build_object(
                'problem_statement', ps.problem_statement,
                'created_at', ps.created_at::text,
                'updated_at', ps.updated_at::text
            )
        ) FILTER (WHERE ps.id IS NOT NULL),
        '{}'::jsonb
    ) as mapping
    FROM problem_statement_data ps
),
-- Get policy parameter item ID for filtering
policy_param_item AS (
    SELECT f.id
    FROM fields f
    JOIN field_parameters fp ON fp.field_id = f.id AND fp.active = true
    JOIN parameters p ON p.id = fp.parameter_id
    WHERE p.name = 'Document Type' AND p.document_parameter = true
    AND f.value = 'policy'
    LIMIT 1
),
-- Documents (filtered to only include policy documents)
document_data AS (
    SELECT DISTINCT
        d.id,
        d.name,
        '' as description,
        u.file_path,
        u.mime_type,
        du.upload_id
    FROM documents d
    LEFT JOIN document_uploads du ON du.document_id = d.id AND du.active = true
    LEFT JOIN uploads u ON u.id = du.upload_id
    CROSS JOIN policy_param_item ppi
    JOIN document_fields df ON df.document_id = d.id AND df.field_id = ppi.id AND df.active = true
    LEFT JOIN document_departments dd ON dd.document_id = d.id AND dd.active = true
    CROSS JOIN user_profile up
    WHERE d.active = true
        AND (
            up.role = 'superadmin'
            OR dd.department_id IN (SELECT department_id FROM user_departments)
            OR NOT EXISTS (SELECT 1 FROM document_departments dd2 WHERE dd2.document_id = d.id AND dd2.active = true)
        )
),
document_mapping_data AS (
    SELECT COALESCE(
        jsonb_object_agg(
            d.id::text,
            jsonb_build_object(
                'name', d.name,
                'description', d.description,
                'extension', CASE 
                    WHEN u.file_path IS NOT NULL THEN SUBSTRING(u.file_path FROM '\.([^\.]+)$')
                    ELSE NULL
                END,
                'filePath', u.file_path,
                'mimeType', u.mime_type,
                'uploadId', d.upload_id::text
            )
        ) FILTER (WHERE d.id IS NOT NULL),
        '{}'::jsonb
    ) as mapping
    FROM document_data d
),
valid_document_ids_data AS (
    SELECT ARRAY_AGG(id::text ORDER BY id) as document_ids
    FROM document_data
),
-- Objectives (shared between scenarios only - videos now use outlines)
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
        OR sd.department_id IN (SELECT department_id FROM user_departments)
        OR NOT EXISTS (SELECT 1 FROM scenario_departments sd2 WHERE sd2.scenario_id = so.scenario_id AND sd2.active = true)
    )
),
objectives_history_data AS (
    SELECT ARRAY_AGG(o.objective ORDER BY o.id) as objectives_history
    FROM objectives_data o
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
            SELECT 1 FROM user_departments ud
            WHERE ud.department_id = ad.department_id
        )
        OR NOT EXISTS (SELECT 1 FROM agent_departments ad2 WHERE ad2.agent_id = a.id AND ad2.active = true)
    )
),
-- Video parameters (filtered by video_parameter = true OR document_parameter = true)
video_parameter_data AS (
    SELECT DISTINCT 
        p.id,
        p.name,
        COALESCE(p.description, '') as description,
        p.numerical,
        p.document_parameter,
        p.video_parameter
    FROM parameters p
    JOIN field_parameters fp ON fp.parameter_id = p.id AND fp.active = true
    LEFT JOIN field_departments fd ON fd.field_id = fp.field_id AND fd.active = true
    WHERE p.active = true AND (p.video_parameter = true OR p.document_parameter = true)
    GROUP BY p.id, p.name, p.description, p.numerical, p.document_parameter, p.video_parameter
    HAVING 
        COUNT(fd.field_id) FILTER (WHERE pid.department_id IN (SELECT department_id FROM user_departments)) > 0
        OR NOT EXISTS (SELECT 1 FROM field_departments fd2 
                      JOIN field_parameters fp2 ON fp2.field_id = fd2.field_id 
                      WHERE pi2.parameter_id = p.id AND pid2.active = true)
),
video_parameter_mapping_data AS (
    SELECT 
        COALESCE(jsonb_object_agg(
            p.id::text,
            jsonb_build_object(
                'name', p.name, 
                'description', p.description, 
                'numerical', p.numerical,
                'document_parameter', p.document_parameter,
                'video_parameter', p.video_parameter
            )
        ), '{}'::jsonb) as parameter_mapping
    FROM video_parameter_data p
),
video_parameter_items_data AS (
    SELECT 
        pi.id,
        pi.name,
        COALESCE(pi.description, '') as description,
        pi.parameter_id,
        p.name as parameter_name,
        pi.value
    FROM fields f
    JOIN field_parameters fp ON fp.field_id = f.id AND fp.active = true
    JOIN parameters p ON p.id = fp.parameter_id
    LEFT JOIN field_departments fd ON fd.field_id = f.id AND fd.active = true
    WHERE p.active = true AND (p.video_parameter = true OR p.document_parameter = true)
    GROUP BY f.id, f.name, f.description, fp.parameter_id, p.id, p.name, f.value
    HAVING 
        COUNT(fd.field_id) FILTER (WHERE fd.department_id IN (SELECT department_id FROM user_departments)) > 0
        OR NOT EXISTS (SELECT 1 FROM field_departments fd2 WHERE fd2.field_id = f.id AND fd2.active = true)
),
video_parameter_item_mapping_data AS (
    SELECT 
        COALESCE(jsonb_object_agg(
            pi.id::text,
            jsonb_build_object(
                'name', pi.name,
                'description', pi.description,
                'parameter_id', pi.parameter_id::text,
                'parameter_name', pi.parameter_name,
                'value', pi.value
            )
        ), '{}'::jsonb) as parameter_item_mapping
    FROM video_parameter_items_data pi
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
    LEFT JOIN persona_agents pa ON pa.persona_id = p.id AND pa.active = true
    LEFT JOIN agents a ON a.id = pa.agent_id
    LEFT JOIN models m ON m.id = a.model_id
    LEFT JOIN image_model_check imc ON imc.model_id = m.id
    LEFT JOIN persona_departments pd ON pd.persona_id = p.id AND pd.active = true
    CROSS JOIN user_departments ud
    WHERE p.active = true
    GROUP BY p.id, p.name, p.description, p.color, p.icon, imc.image_model
    HAVING 
        COUNT(pd.persona_id) FILTER (WHERE pd.department_id = ANY((SELECT ARRAY_AGG(department_id) FROM user_departments))) > 0
        OR NOT EXISTS (SELECT 1 FROM persona_departments pd2 WHERE pd2.persona_id = p.id AND pd2.active = true)
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
                'image_model', COALESCE(p.image_model, false)
            )
        ), '{}'::jsonb) as persona_mapping
    FROM valid_personas_filtered p
)
SELECT 
    COALESCE((SELECT department_ids FROM department_ids_array), ARRAY[]::text[]) as department_ids,
    COALESCE((SELECT mapping FROM department_mapping_data), '{}'::jsonb) as department_mapping,
    COALESCE((SELECT mapping FROM problem_statement_mapping_data), '{}'::jsonb) as problem_statement_mapping,
    COALESCE((SELECT mapping FROM document_mapping_data), '{}'::jsonb) as document_mapping,
    COALESCE((SELECT document_ids FROM valid_document_ids_data), ARRAY[]::text[]) as valid_document_ids,
    COALESCE((SELECT objectives_history FROM objectives_history_data), ARRAY[]::text[]) as objectives_history,
    (SELECT role FROM user_profile) as user_role,
    (SELECT primary_department_id::text FROM user_profile) as primary_department_id,
    COALESCE((SELECT agent_mapping FROM valid_agents), '{}'::jsonb) as agent_mapping,
    COALESCE((SELECT agent_ids FROM valid_agents), ARRAY[]::text[]) as valid_agent_ids,
    COALESCE((SELECT parameter_mapping FROM video_parameter_mapping_data), '{}'::jsonb) as parameter_mapping,
    COALESCE((SELECT parameter_item_mapping FROM video_parameter_item_mapping_data), '{}'::jsonb) as parameter_item_mapping,
    COALESCE((SELECT valid_persona_ids FROM valid_personas_data), ARRAY[]::text[]) as valid_persona_ids,
    COALESCE((SELECT persona_mapping FROM valid_personas_data), '{}'::jsonb) as persona_mapping

