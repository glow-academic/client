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
primary_department_id AS (
    SELECT department_id::text
    FROM profile_departments
    WHERE profile_id = $1 AND is_primary = TRUE
    LIMIT 1
),
first_user_department AS (
    SELECT ud.department_id as id
    FROM user_departments ud
    ORDER BY ud.department_id
    LIMIT 1
),
resolved_department_for_agents AS (
    -- Use primary department if available, otherwise first accessible department
    SELECT COALESCE(
        (SELECT pd.department_id FROM profile_departments pd WHERE pd.profile_id = $1 AND pd.is_primary = TRUE LIMIT 1),
        (SELECT id FROM first_user_department)
    ) as department_id
),
default_outline_agent AS (
    -- Get best outline agent for the resolved department
    SELECT a.id::text as agent_id
    FROM agents a
    LEFT JOIN agent_departments ad ON ad.agent_id = a.id AND ad.active = true
    CROSS JOIN resolved_department_for_agents rdfa
    WHERE a.role = 'outline'
    AND a.active = true
    AND (
        -- Include if agent is linked to the resolved department
        ad.department_id = rdfa.department_id
        -- OR agent has no department links (cross-department)
        OR NOT EXISTS (SELECT 1 FROM agent_departments ad2 WHERE ad2.agent_id = a.id AND ad2.active = true)
    )
    ORDER BY 
        -- Prioritize department-specific agents over cross-department agents
        CASE WHEN ad.department_id = rdfa.department_id THEN 0 ELSE 1 END
    LIMIT 1
),
default_image_agent AS (
    -- Get best image agent for the resolved department
    SELECT a.id::text as agent_id
    FROM agents a
    LEFT JOIN agent_departments ad ON ad.agent_id = a.id AND ad.active = true
    CROSS JOIN resolved_department_for_agents rdfa
    WHERE a.role = 'image'
    AND a.active = true
    AND (
        -- Include if agent is linked to the resolved department
        ad.department_id = rdfa.department_id
        -- OR agent has no department links (cross-department)
        OR NOT EXISTS (SELECT 1 FROM agent_departments ad2 WHERE ad2.agent_id = a.id AND ad2.active = true)
    )
    ORDER BY 
        -- Prioritize department-specific agents over cross-department agents
        CASE WHEN ad.department_id = rdfa.department_id THEN 0 ELSE 1 END
    LIMIT 1
),
default_video_agent AS (
    -- Get best video agent for the resolved department
    SELECT a.id::text as agent_id
    FROM agents a
    LEFT JOIN agent_departments ad ON ad.agent_id = a.id AND ad.active = true
    CROSS JOIN resolved_department_for_agents rdfa
    WHERE a.role = 'video'
    AND a.active = true
    AND (
        -- Include if agent is linked to the resolved department
        ad.department_id = rdfa.department_id
        -- OR agent has no department links (cross-department)
        OR NOT EXISTS (SELECT 1 FROM agent_departments ad2 WHERE ad2.agent_id = a.id AND ad2.active = true)
    )
    ORDER BY 
        -- Prioritize department-specific agents over cross-department agents
        CASE WHEN ad.department_id = rdfa.department_id THEN 0 ELSE 1 END
    LIMIT 1
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
-- Documents (filtered by department access, exclude scenario_parameter documents)
valid_documents_filtered AS (
    SELECT DISTINCT
        d.id,
        d.name,
        '' as description
    FROM documents d
    LEFT JOIN document_departments dd ON dd.document_id = d.id AND dd.active = true
    CROSS JOIN user_departments ud
    WHERE d.active = true
    GROUP BY d.id, d.name
    HAVING 
        (
            COUNT(dd.document_id) FILTER (WHERE dd.department_id IN (SELECT department_id FROM user_departments)) > 0
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
document_data AS (
    SELECT 
        vdf.id,
        vdf.name,
        vdf.description,
        COALESCE(u.file_path, template_u.file_path, '') as file_path,
        COALESCE(u.mime_type, template_u.mime_type, '') as mime_type,
        COALESCE(du.upload_id::text, template_u.id::text, '') as upload_id
    FROM valid_documents_filtered vdf
    LEFT JOIN (
        SELECT DISTINCT ON (du.document_id) du.document_id, du.upload_id
        FROM document_uploads du
        WHERE du.active = true
        ORDER BY du.document_id, du.created_at DESC
    ) du ON du.document_id = vdf.id
    LEFT JOIN uploads u ON u.id = du.upload_id
    LEFT JOIN document_templates dt ON dt.document_id = vdf.id AND dt.active = true
    LEFT JOIN templates t ON t.id = dt.template_id
    LEFT JOIN uploads template_u ON template_u.id = t.upload_id
),
-- Document parameter relationships: direct (parameter_documents) and via fields (document_fields → parameter_fields)
document_parameter_relationships AS (
    SELECT DISTINCT
        d.id as document_id,
        param.id as parameter_id
    FROM document_data d
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
document_mapping_data AS (
    SELECT COALESCE(
        jsonb_object_agg(
            d.id::text,
            jsonb_build_object(
                'name', d.name,
                'description', d.description,
                'extension', COALESCE(
                    CASE 
                        WHEN d.file_path IS NOT NULL AND d.file_path != '' THEN SUBSTRING(d.file_path FROM '\.([^\.]+)$')
                        ELSE NULL
                    END,
                    ''
                ),
                'filePath', COALESCE(d.file_path, ''),
                'mimeType', COALESCE(d.mime_type, ''),
                'uploadId', COALESCE(d.upload_id::text, ''),
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
    FROM document_data d
),
valid_document_ids_data AS (
    SELECT ARRAY_AGG(id::text ORDER BY id) as document_ids
    FROM document_data
),
document_details_data AS (
    SELECT COALESCE(
        (
            SELECT jsonb_agg(
                jsonb_build_object(
                    'document_id', dd.id::text,
                    'name', dd.name,
                    'updatedAt', d.updated_at::text,
                    'extension', COALESCE(
                        CASE 
                            WHEN dd.file_path IS NOT NULL AND dd.file_path != '' THEN SUBSTRING(dd.file_path FROM '\.([^\.]+)$')
                            ELSE NULL
                        END,
                        ''
                    ),
                    'scenario_ids', '[]'::jsonb,
                    'can_edit', true,
                    'can_delete', true,
                    'active', d.active,
                    'file_path', COALESCE(dd.file_path, ''),
                    'mime_type', COALESCE(dd.mime_type, ''),
                    'upload_id', COALESCE(NULLIF(dd.upload_id, ''), NULL),
                    'parameter_item_ids', COALESCE((
                        SELECT jsonb_agg(df.field_id::text)
                        FROM document_fields df
                        WHERE df.document_id = dd.id AND df.active = true
                    ), '[]'::jsonb)
                ) ORDER BY dd.name
            )
            FROM document_data dd
            JOIN documents d ON d.id = dd.id
            WHERE d.active = true
        ),
        '[]'::jsonb
    ) as document_details
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
    -- Get agents with roles 'outline', 'image', or 'video'
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
    AND a.role IN ('outline', 'image', 'video')
    AND (
        EXISTS (
            SELECT 1 FROM user_departments ud
            WHERE ud.department_id = ad.department_id
        )
        OR NOT EXISTS (SELECT 1 FROM agent_departments ad2 WHERE ad2.agent_id = a.id AND ad2.active = true)
    )
),
-- Video parameters (get ALL parameters where video_parameter = true, filtered by department access)
parameter_data_for_mapping AS (
    SELECT DISTINCT 
        p.id,
        p.name,
        COALESCE(p.description, '') as description,
        CASE WHEN EXISTS (SELECT 1 FROM parameter_documents pd WHERE pd.parameter_id = p.id AND pd.active = true) THEN true ELSE false END as document_parameter,
        true as video_parameter  -- p.video_parameter = true is already filtered in WHERE clause
    FROM parameters p
    JOIN parameter_fields fp ON fp.parameter_id = p.id AND fp.active = true
    LEFT JOIN field_departments fd ON fd.field_id = fp.field_id AND fd.active = true
    CROSS JOIN user_departments ud
    WHERE p.active = true
    AND p.video_parameter = true
    GROUP BY p.id, p.name, p.description
    HAVING 
        COUNT(fd.field_id) FILTER (WHERE fd.department_id IN (SELECT department_id FROM user_departments)) > 0
        OR NOT EXISTS (SELECT 1 FROM field_departments fd2 
                      JOIN parameter_fields fp2 ON fp2.field_id = fd2.field_id 
                      WHERE fp2.parameter_id = p.id AND fp2.active = true)
    ORDER BY p.name
),
document_parameters_for_video AS (
    -- Only include parameters linked via parameter_documents that ALSO have video_parameter = true
    -- This matches scenario behavior which only includes scenario_parameter = true
    SELECT DISTINCT
        p.id,
        p.name,
        COALESCE(p.description, '') as description,
        true as document_parameter,
        true as video_parameter  -- Must have video_parameter = true to be included
    FROM parameter_documents pd
    JOIN parameters p ON p.id = pd.parameter_id
    JOIN parameter_fields pf ON pf.parameter_id = p.id AND pf.active = true
    LEFT JOIN field_departments fd ON fd.field_id = pf.field_id AND fd.active = true
    CROSS JOIN user_departments ud
    WHERE pd.active = true
    AND p.active = true
    AND p.video_parameter = true  -- Only include if video_parameter = true
    GROUP BY p.id, p.name, p.description
    HAVING 
        COUNT(fd.field_id) FILTER (WHERE fd.department_id IN (SELECT department_id FROM user_departments)) > 0
        OR NOT EXISTS (SELECT 1 FROM field_departments fd2 
                      JOIN parameter_fields pf2 ON pf2.field_id = fd2.field_id 
                      WHERE pf2.parameter_id = p.id AND pf2.active = true)
    ORDER BY p.name
),
video_parameter_data AS (
    -- Combine video and document parameters, ensuring flags are set correctly
    SELECT DISTINCT
        COALESCE(vp.id, dp.id) as id,
        COALESCE(vp.name, dp.name) as name,
        COALESCE(vp.description, dp.description, '') as description,
        COALESCE(dp.document_parameter, false) as document_parameter,
        COALESCE(vp.video_parameter, dp.video_parameter, false) as video_parameter
    FROM parameter_data_for_mapping vp
    FULL OUTER JOIN document_parameters_for_video dp ON vp.id = dp.id
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
        COUNT(fd.field_id) FILTER (WHERE fd.department_id IN (SELECT department_id FROM user_departments)) > 0
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
        COUNT(pd.persona_id) FILTER (WHERE pd.department_id IN (SELECT department_id FROM user_departments)) > 0
        OR NOT EXISTS (SELECT 1 FROM persona_departments pd2 WHERE pd2.persona_id = p.id AND pd2.active = true)
),
-- Persona parameter relationships: direct (parameter_personas) and via fields (persona_fields → parameter_fields)
persona_parameter_relationships AS (
    SELECT DISTINCT
        p.id as persona_id,
        param.id as parameter_id
    FROM valid_personas_filtered p
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
    FROM valid_personas_filtered p
)
SELECT 
    COALESCE((SELECT department_ids FROM department_ids_array), ARRAY[]::text[]) as department_ids,
    COALESCE((SELECT mapping FROM department_mapping_data), '{}'::jsonb) as department_mapping,
    COALESCE((SELECT mapping FROM problem_statement_mapping_data), '{}'::jsonb) as problem_statement_mapping,
    COALESCE((SELECT mapping FROM document_mapping_data), '{}'::jsonb) as document_mapping,
    COALESCE((SELECT document_ids FROM valid_document_ids_data), ARRAY[]::text[]) as valid_document_ids,
    COALESCE((SELECT document_details FROM document_details_data), '[]'::jsonb) as document_details,
    COALESCE((SELECT objectives_history FROM objectives_history_data), ARRAY[]::text[]) as objectives_history,
    (SELECT role FROM user_profile) as user_role,
    (SELECT primary_department_id::text FROM user_profile) as primary_department_id,
    COALESCE((SELECT agent_id FROM default_outline_agent), '') as outline_agent_id,
    COALESCE((SELECT agent_id FROM default_image_agent), '') as image_agent_id,
    COALESCE((SELECT agent_id FROM default_video_agent), '') as video_agent_id,
    COALESCE((SELECT agent_mapping FROM valid_agents), '{}'::jsonb) as agent_mapping,
    COALESCE((SELECT agent_ids FROM valid_agents), ARRAY[]::text[]) as valid_agent_ids,
    COALESCE((SELECT parameter_mapping FROM video_parameter_mapping_data), '{}'::jsonb) as parameter_mapping,
    COALESCE((SELECT array_agg(id::text) FROM video_parameter_data), ARRAY[]::text[]) as valid_parameter_ids,
    COALESCE((SELECT field_mapping FROM video_field_mapping_data), '{}'::jsonb) as field_mapping,
    COALESCE((SELECT valid_persona_ids FROM valid_personas_data), ARRAY[]::text[]) as valid_persona_ids,
    COALESCE((SELECT persona_mapping FROM valid_personas_data), '{}'::jsonb) as persona_mapping

