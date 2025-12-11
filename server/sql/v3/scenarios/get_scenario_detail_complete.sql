-- Get scenario detail with departments, problem statements, and access control
-- Parameters: $1 = scenario_id (uuid), $2 = profile_id (uuid or "guest-profile-id"), $3 = use_image (bool, nullable), $4 = use_objectives (bool, nullable), $5 = document_ids (uuid[], nullable), $6 = problem_statement_ids (uuid[], nullable), $7 = template_document_ids (uuid[], nullable)

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
scenario_departments_data AS (
    SELECT 
        sd.scenario_id,
        ARRAY_AGG(sd.department_id::text ORDER BY sd.created_at) as department_ids
    FROM scenario_departments sd
    WHERE sd.scenario_id = $1 AND sd.active = true
    GROUP BY sd.scenario_id
),
scenario_active_problem_statement AS (
    SELECT 
        sps.scenario_id,
        ps.id::text as problem_statement_id,
        ps.name,
        ps.problem_statement,
        ps.created_at as problem_statement_created_at,
        ps.updated_at as problem_statement_updated_at
    FROM scenario_problem_statements sps
    JOIN problem_statements ps ON ps.id = sps.problem_statement_id
    WHERE sps.scenario_id = $1 AND sps.active = true
    LIMIT 1
),
scenario_all_problem_statements AS (
    SELECT 
        sps.scenario_id,
        ps.id::text as problem_statement_id,
        ps.name,
        ps.problem_statement,
        ps.created_at as problem_statement_created_at,
        ps.updated_at as problem_statement_updated_at
    FROM scenario_problem_statements sps
    JOIN problem_statements ps ON ps.id = sps.problem_statement_id
    WHERE sps.scenario_id = $1
),
problem_statement_mapping_data AS (
    SELECT 
        COALESCE(
            (
                SELECT jsonb_object_agg(
                    ps_id,
                    ps_data
                )
                FROM (
                    -- Problem statements from scenario
                    SELECT 
                        sps.problem_statement_id as ps_id,
                        jsonb_build_object(
                            'name', sps.name,
                            'problem_statement', sps.problem_statement,
                            'created_at', sps.problem_statement_created_at::text,
                            'updated_at', sps.problem_statement_updated_at::text
                        ) as ps_data
                    FROM scenario_all_problem_statements sps
                    UNION ALL
                    -- Problem statements from provided IDs
                    SELECT 
                        ps.id::text as ps_id,
                        jsonb_build_object(
                            'name', ps.name,
                            'problem_statement', ps.problem_statement,
                            'created_at', ps.created_at::text,
                            'updated_at', ps.updated_at::text
                        ) as ps_data
                    FROM problem_statements ps
                    WHERE $6::uuid[] IS NOT NULL
                    AND array_length($6::uuid[], 1) > 0
                    AND ps.id = ANY($6::uuid[])
                    AND NOT EXISTS (
                        SELECT 1
                        FROM scenario_all_problem_statements saps
                        WHERE saps.problem_statement_id::uuid = ps.id
                    )
                ) combined
            ),
            '{}'::jsonb
        ) as problem_statement_mapping
    FROM (SELECT 1) dummy
),
scenario_department_access_check AS (
    SELECT 
        s.id as scenario_id,
        CASE 
            WHEN up.role = 'superadmin' THEN true
            WHEN EXISTS (
                SELECT 1 FROM scenario_departments sd 
                WHERE sd.scenario_id = s.id 
                AND sd.active = true 
                AND sd.department_id IN (SELECT department_id FROM resolve_profile_id rpi JOIN profile_departments pd ON pd.profile_id = rpi.resolved_profile_id WHERE pd.active = true)
            ) THEN true
            WHEN NOT EXISTS (
                SELECT 1 FROM scenario_departments sd2 
                WHERE sd2.scenario_id = s.id 
                AND sd2.active = true
            ) THEN true  -- Cross-department resource
            ELSE false
        END as has_access
    FROM scenarios s
    CROSS JOIN user_profile up
    WHERE s.id = $1
),
scenario_core AS (
    SELECT 
        s.id,
        s.name,
        COALESCE(saps.problem_statement, '') as problem_statement,
        COALESCE(saps.problem_statement_id, NULL) as problem_statement_id,
        s.active,
        s.generated,
        st.parent_id::text as parent_scenario_id,
        COALESCE(sdd.department_ids, NULL) as department_ids,
        s.documents_enabled,
        s.document_vision_enabled,
        s.objectives_enabled,
        s.image_enabled,
        s.scenario_agent_id::text,
        s.image_agent_id::text
    FROM scenarios s
    LEFT JOIN scenario_tree st ON st.child_id = s.id AND st.parent_id != st.child_id
    LEFT JOIN scenario_active_problem_statement saps ON saps.scenario_id = s.id
    LEFT JOIN scenario_departments_data sdd ON sdd.scenario_id = s.id
    INNER JOIN scenario_department_access_check sdac ON sdac.scenario_id = s.id AND sdac.has_access = true
    WHERE s.id = $1
),
scenario_simulation_attributes AS (
    SELECT DISTINCT ON (ss.scenario_id)
        ss.scenario_id,
        ss.hints_enabled
    FROM simulation_scenarios ss
    WHERE ss.scenario_id = $1 AND ss.active = true
    ORDER BY ss.scenario_id, ss.position
    LIMIT 1
),
scenario_personas_agg AS (
    SELECT ARRAY_AGG(persona_id::text ORDER BY persona_id) as persona_ids
    FROM scenario_personas
    WHERE scenario_id = $1 AND active = true
),
scenario_documents_agg AS (
    SELECT ARRAY_AGG(document_id::text ORDER BY document_id) as document_ids
    FROM scenario_documents
    WHERE scenario_id = $1 AND active = true
),
scenario_images_data AS (
    SELECT COALESCE(
        jsonb_agg(
            jsonb_build_object(
                'id', si.upload_id::text,
                'name', si.name,
                'upload_id', si.upload_id::text,
                'active', si.active
            )
        ) FILTER (WHERE si.upload_id IS NOT NULL),
        '[]'::jsonb
    ) as scenario_images
    FROM scenario_images si
    WHERE si.scenario_id = $1 AND si.active = true
),
scenario_objectives_data AS (
    SELECT 
        COALESCE(ARRAY_AGG(o.id::text ORDER BY so.idx), ARRAY[]::text[]) as objective_ids,
        COALESCE(jsonb_object_agg(
            o.id::text,
            jsonb_build_object('name', o.objective, 'description', o.objective)
        ) FILTER (WHERE o.objective IS NOT NULL), '{}'::jsonb) as objective_mapping
    FROM scenario_objectives so
    JOIN objectives o ON o.id = so.objective_id
    WHERE so.scenario_id = $1
),
scenario_simulations_agg AS (
    SELECT 
        COALESCE(ARRAY_AGG(DISTINCT simulation_id::text), ARRAY[]::text[]) as simulation_ids,
        COUNT(DISTINCT CASE WHEN s.active THEN simulation_id END) as active_usage_count
    FROM simulation_scenarios ss
    JOIN simulations s ON s.id = ss.simulation_id
    WHERE ss.scenario_id = $1 AND ss.active = true
),
all_parameters_data AS (
    SELECT 
        p.id::text as param_id,
        COALESCE((
            SELECT jsonb_agg(sf2.field_id::text ORDER BY sf2.field_id)
            FROM scenario_fields sf2
            JOIN parameter_fields fp2 ON fp2.field_id = sf2.field_id AND fp2.active = true
            WHERE sf2.scenario_id = $1 AND fp2.parameter_id = p.id AND sf2.active = true
        ), '[]'::jsonb) as selected_items,
        COALESCE((
            SELECT jsonb_agg(id::text ORDER BY id::text)
            FROM (
                SELECT f3.id
                FROM fields f3
                JOIN parameter_fields fp3 ON fp3.field_id = f3.id AND fp3.active = true
                LEFT JOIN field_departments fd3 ON fd3.field_id = f3.id AND fd3.active = true
                CROSS JOIN user_departments ud3
                WHERE fp3.parameter_id = p.id
                GROUP BY f3.id
                HAVING 
                    COUNT(fd3.field_id) FILTER (WHERE fd3.department_id = ANY(ud3.dept_ids)) > 0
                    OR NOT EXISTS (SELECT 1 FROM field_departments fd4 WHERE fd4.field_id = f3.id AND fd4.active = true)
                UNION
                SELECT sf2.field_id as id
                FROM scenario_fields sf2
                JOIN parameter_fields fp2 ON fp2.field_id = sf2.field_id AND fp2.active = true
                WHERE sf2.scenario_id = $1 AND fp2.parameter_id = p.id AND sf2.active = true
            ) combined_items
        ), '[]'::jsonb) as valid_items
    FROM parameters p
    JOIN parameter_fields fp ON fp.parameter_id = p.id AND fp.active = true
    LEFT JOIN field_departments fd ON fd.field_id = fp.field_id AND fd.active = true
    CROSS JOIN user_departments ud
    WHERE p.active = true
    GROUP BY p.id
    HAVING 
        COUNT(fd.field_id) FILTER (WHERE fd.department_id = ANY(ud.dept_ids)) > 0
        OR NOT EXISTS (SELECT 1 FROM field_departments fd2 
                      JOIN parameter_fields fp2 ON fp2.field_id = fd2.field_id 
                      WHERE fp2.parameter_id = p.id AND fd2.active = true)
),
merged_parameters_data AS (
    SELECT 
        COALESCE(jsonb_object_agg(
            param_id,
            jsonb_build_object(
                'parameter_item_ids', selected_items,
                'valid_parameter_item_ids', valid_items
            )
        ), '{}'::jsonb) as parameters_json
    FROM all_parameters_data
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
    LEFT JOIN persona_text_agents pta ON pta.persona_id = p.id AND pta.active = true
    LEFT JOIN agents a ON a.id = pta.agent_id
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
        AND NOT EXISTS (
            SELECT 1 
            FROM persona_fields pf
            JOIN parameter_fields pfield ON pfield.field_id = pf.field_id
            JOIN parameters param ON param.id = pfield.parameter_id
            WHERE pf.persona_id = p.id
            AND pf.active = true
            AND pfield.active = true
            AND param.active = true
            AND param.video_parameter = true
        )
),
persona_data AS (
    SELECT 
        p.id,
        p.name,
        p.description,
        p.color,
        p.icon,
        p.image_model
    FROM valid_personas_filtered p
    UNION
    SELECT DISTINCT
        p2.id,
        p2.name,
        COALESCE(p2.description, '') as description,
        p2.color,
        p2.icon,
        COALESCE(imc2.image_model, false) as image_model
    FROM scenario_personas_agg spa
    CROSS JOIN LATERAL unnest(spa.persona_ids) as persona_id
    JOIN personas p2 ON p2.id = persona_id::uuid
    LEFT JOIN persona_text_agents pta2 ON pta2.persona_id = p2.id AND pta2.active = true
    LEFT JOIN agents a2 ON a2.id = pta2.agent_id
    LEFT JOIN models m2 ON m2.id = a2.model_id
    LEFT JOIN image_model_check imc2 ON imc2.model_id = m2.id
    WHERE p2.active = true
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
persona_examples_data AS (
    -- Get top example per persona (ordered by idx, take first)
    SELECT DISTINCT ON (pe.persona_id)
        pe.persona_id,
        e.example
    FROM persona_examples pe
    JOIN examples e ON e.id = pe.example_id
    WHERE pe.persona_id IN (SELECT id FROM persona_data)
    ORDER BY pe.persona_id, pe.idx
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
                ),
                'example', CASE WHEN ped.example IS NOT NULL THEN ped.example ELSE NULL END
            )
        ), '{}'::jsonb) as persona_mapping
    FROM persona_data p
    LEFT JOIN persona_examples_data ped ON ped.persona_id = p.id
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
        AND NOT EXISTS (
            SELECT 1 
            FROM document_fields df
            JOIN parameter_fields pfield ON pfield.field_id = df.field_id
            JOIN parameters param ON param.id = pfield.parameter_id
            WHERE df.document_id = d.id
            AND df.active = true
            AND pfield.active = true
            AND param.active = true
            AND param.video_parameter = true
        )
),
document_data AS (
    SELECT 
        d.id,
        d.name,
        d.description,
        d.file_path,
        d.mime_type
    FROM valid_documents_filtered d
    UNION
    SELECT DISTINCT
        d2.id,
        d2.name,
        ''::text as description,
        u2.file_path,
        u2.mime_type
    FROM scenario_documents_agg sda
    CROSS JOIN LATERAL unnest(sda.document_ids) as doc_id
    JOIN documents d2 ON d2.id = doc_id::uuid
    LEFT JOIN document_uploads du2 ON du2.document_id = d2.id AND du2.active = true
    LEFT JOIN uploads u2 ON u2.id = du2.upload_id
    WHERE d2.active = true
    UNION
    -- Include provided documentIds even if they don't match department filters
    SELECT DISTINCT
        d3.id,
        d3.name,
        ''::text as description,
        u3.file_path,
        u3.mime_type
    FROM documents d3
    LEFT JOIN document_uploads du3 ON du3.document_id = d3.id AND du3.active = true
    LEFT JOIN uploads u3 ON u3.id = du3.upload_id
    WHERE d3.active = true
    AND $5::uuid[] IS NOT NULL
    AND array_length($5::uuid[], 1) > 0
    AND d3.id = ANY($5::uuid[])
    AND NOT EXISTS (
        SELECT 1 
        FROM document_fields df
        JOIN parameter_fields pfield ON pfield.field_id = df.field_id
        JOIN parameters param ON param.id = pfield.parameter_id
        WHERE df.document_id = d3.id
        AND df.active = true
        AND pfield.active = true
        AND param.active = true
        AND param.video_parameter = true
    )
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
valid_documents_data AS (
    SELECT 
        COALESCE(ARRAY_AGG(d.id::text ORDER BY d.name), ARRAY[]::text[]) as valid_document_ids,
        COALESCE(jsonb_object_agg(
            d.id::text,
            jsonb_build_object(
                'name', d.name,
                'description', d.description,
                'filePath', d.file_path,
                'mimeType', d.mime_type,
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
        ), '{}'::jsonb) as document_mapping
    FROM document_data d
),
scenario_documents_mapping_data AS (
    SELECT COALESCE(
        jsonb_object_agg(
            d.id::text,
            jsonb_build_object(
                'name', d.name,
                'description', '',
                'filePath', u.file_path,
                'mimeType', u.mime_type
            )
        ),
        '{}'::jsonb
    ) as document_mapping
    FROM scenario_documents sd
    JOIN documents d ON d.id = sd.document_id
    LEFT JOIN document_uploads du ON du.document_id = d.id AND du.active = true
    LEFT JOIN uploads u ON u.id = du.upload_id
    WHERE sd.scenario_id = $1 AND sd.active = true AND d.active = true
),
enhanced_document_mapping_data AS (
    SELECT 
        COALESCE(
            (
                SELECT jsonb_object_agg(key, value)
                FROM (
                    SELECT key, value 
                    FROM jsonb_each(vdd.document_mapping)
                    UNION ALL
                    SELECT key, value 
                    FROM jsonb_each(sdmd.document_mapping)
                ) combined
            ),
            '{}'::jsonb
        ) as document_mapping
    FROM valid_documents_data vdd
    CROSS JOIN scenario_documents_mapping_data sdmd
),
document_details_data AS (
    SELECT COALESCE(
        (
            SELECT jsonb_agg(
                jsonb_build_object(
                    'document_id', d.id::text,
                    'name', d.name,
                    'updatedAt', d.updated_at::text,
                    'extension', CASE WHEN u.file_path IS NOT NULL THEN SUBSTRING(u.file_path FROM '\\.([^\\.]+)$') ELSE NULL END,
                    'scenario_ids', COALESCE((
                        SELECT jsonb_agg(sd2.scenario_id::text)
                        FROM scenario_documents sd2
                        WHERE sd2.document_id = d.id AND sd2.active = true
                    ), '[]'::jsonb),
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
            FROM (
                -- Documents linked to scenario
                SELECT d.id, d.name, d.updated_at, d.active, u.file_path, u.mime_type, u.id as upload_id
            FROM scenario_documents sd
            JOIN documents d ON d.id = sd.document_id
            LEFT JOIN document_uploads du ON du.document_id = d.id AND du.active = true
            LEFT JOIN uploads u ON u.id = du.upload_id
                WHERE sd.scenario_id = $1 AND sd.active = true AND d.active = true
                UNION
                -- Provided documentIds not already linked to scenario
                SELECT d.id, d.name, d.updated_at, d.active, u.file_path, u.mime_type, u.id as upload_id
                FROM documents d
                LEFT JOIN document_uploads du ON du.document_id = d.id AND du.active = true
                LEFT JOIN uploads u ON u.id = du.upload_id
                WHERE d.active = true
                AND $5::uuid[] IS NOT NULL
                AND array_length($5::uuid[], 1) > 0
                AND d.id = ANY($5::uuid[])
                AND d.id NOT IN (
                    SELECT document_id 
                    FROM scenario_documents 
                    WHERE scenario_id = $1 AND active = true
                )
            ) d
        ),
        '[]'::jsonb
    ) as document_details
),
simulation_mapping_data AS (
    SELECT COALESCE(jsonb_object_agg(
        s.id::text,
            jsonb_build_object(
                'name', s.title, 
                'description', COALESCE(s.description, ''),
                'time_limit', COALESCE(
                    (SELECT SUM(stl.time_limit_seconds)
                     FROM scenario_time_limits stl
                     JOIN simulation_scenarios ss ON ss.simulation_id = stl.simulation_id AND ss.scenario_id = stl.scenario_id
                     WHERE stl.simulation_id = s.id AND stl.active = true AND ss.active = true),
                    0
                ),
                'department_ids', COALESCE(
                    (SELECT ARRAY_AGG(sd.department_id::text ORDER BY sd.created_at)
                     FROM simulation_departments sd
                     WHERE sd.simulation_id = s.id AND sd.active = true),
                    NULL
                )
            )
    ), '{}'::jsonb) as simulation_mapping
    FROM simulations s
    WHERE s.id = ANY(
        COALESCE((SELECT simulation_ids::uuid[] FROM scenario_simulations_agg), ARRAY[]::uuid[])
    )
),
linked_scenario_parameters AS (
    -- Get parameters linked to this scenario via scenario_parameters junction table
    SELECT DISTINCT
        p.id,
        p.name,
        COALESCE(p.description, '') as description,
        CASE WHEN EXISTS (SELECT 1 FROM parameter_documents pd WHERE pd.parameter_id = p.id AND pd.active = true) THEN true ELSE false END as document_parameter,
        CASE WHEN EXISTS (SELECT 1 FROM parameter_personas pp WHERE pp.parameter_id = p.id AND pp.active = true) THEN true ELSE false END as persona_parameter
    FROM scenario_parameters sp
    JOIN parameters p ON p.id = sp.parameter_id
    WHERE sp.scenario_id = $1
    AND sp.active = true
    AND p.active = true
),
parameter_data_for_mapping AS (
    SELECT DISTINCT 
        p.id,
        p.name,
        COALESCE(p.description, '') as description,
        CASE WHEN EXISTS (SELECT 1 FROM parameter_documents pd WHERE pd.parameter_id = p.id AND pd.active = true) THEN true ELSE false END as document_parameter,
        CASE WHEN EXISTS (SELECT 1 FROM parameter_personas pp WHERE pp.parameter_id = p.id AND pp.active = true) THEN true ELSE false END as persona_parameter
    FROM parameters p
    JOIN parameter_fields fp ON fp.parameter_id = p.id AND fp.active = true
    LEFT JOIN field_departments fd ON fd.field_id = fp.field_id AND fd.active = true
    CROSS JOIN user_departments ud
    WHERE p.active = true
    AND p.scenario_parameter = true
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
                'persona_parameter', p.persona_parameter
            )
        ), '{}'::jsonb) as parameter_mapping
    FROM parameter_data_for_mapping p
),
scenario_parameters_mapping_data AS (
    SELECT COALESCE(
        jsonb_object_agg(
            p.id::text,
            jsonb_build_object(
                'name', p.name, 
                'description', COALESCE(p.description, ''), 
                'document_parameter', p.document_parameter,
                'persona_parameter', p.persona_parameter
            )
        ),
        '{}'::jsonb
    ) as parameter_mapping
    FROM linked_scenario_parameters p
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
                    FROM jsonb_each(spmd.parameter_mapping)
                ) combined
            ),
            '{}'::jsonb
        ) as parameter_mapping
    FROM parameter_mapping_data pmd
    CROSS JOIN scenario_parameters_mapping_data spmd
),
-- Conditional parameter relationships (field → conditional_parameter)
field_conditional_parameters_data AS (
    SELECT 
        fcp.field_id,
        ARRAY_AGG(fcp.conditional_parameter_id::text ORDER BY fcp.conditional_parameter_id) as conditional_parameter_ids
    FROM field_conditional_parameters fcp
    WHERE fcp.active = true
    GROUP BY fcp.field_id
),
parameter_item_data AS (
    SELECT 
        f.id,
        f.name,
        COALESCE(f.description, '') as description,
        fp.parameter_id,
        p.name as parameter_name
    FROM fields f
    JOIN parameter_fields pf ON pf.field_id = f.id AND pf.active = true
    JOIN parameters p ON p.id = pf.parameter_id
    LEFT JOIN field_departments fd ON fd.field_id = f.id AND fd.active = true
    CROSS JOIN user_departments ud
    WHERE p.active = true AND f.active = true
    GROUP BY f.id, f.name, f.description, pf.parameter_id, p.id, p.name
    HAVING 
        COUNT(fd.field_id) FILTER (WHERE fd.department_id = ANY(ud.dept_ids)) > 0
        OR NOT EXISTS (SELECT 1 FROM field_departments fd2 WHERE fd2.field_id = f.id AND fd2.active = true)
    ORDER BY p.name, f.name
),
field_mapping_data AS (
    SELECT 
        COALESCE(jsonb_object_agg(
            pi.id::text,
            jsonb_build_object(
                'name', pi.name,
                'description', pi.description,
                'parameter_id', pi.parameter_id::text,
                'parameter_name', pi.parameter_name,
                'conditional_parameter_ids', COALESCE(
                    (SELECT to_jsonb(fcpd.conditional_parameter_ids)
                     FROM field_conditional_parameters_data fcpd
                     WHERE fcpd.field_id::text = pi.id::text),
                    '[]'::jsonb
                )
            )
        ), '{}'::jsonb) as field_mapping
    FROM parameter_item_data pi
),
-- Conditional parameters mapping (for easy lookup)
conditional_parameters_mapping AS (
    SELECT COALESCE(
        jsonb_object_agg(
            fcpd.field_id::text,
            to_jsonb(fcpd.conditional_parameter_ids)
        ),
        '{}'::jsonb
    ) as mapping
    FROM field_conditional_parameters_data fcpd
),
scenario_field_mapping_data AS (
    SELECT COALESCE(
        jsonb_object_agg(
            f.id::text,
            jsonb_build_object(
                'name', f.name,
                'description', COALESCE(f.description, ''),
                'parameter_id', fp.parameter_id::text,
                'parameter_name', p.name
            )
        ),
        '{}'::jsonb
    ) as field_mapping
    FROM scenario_fields sf
    JOIN fields f ON f.id = sf.field_id
    JOIN parameter_fields fp ON fp.field_id = f.id AND fp.active = true
    JOIN parameters p ON p.id = fp.parameter_id
    WHERE sf.scenario_id = $1 AND sf.active = true AND p.active = true
),
enhanced_field_mapping_data AS (
    SELECT 
        COALESCE(
            (
                SELECT jsonb_object_agg(key, value)
                FROM (
                    SELECT key, value 
                    FROM jsonb_each(fmd.field_mapping)
                    UNION ALL
                    SELECT key, value 
                    FROM jsonb_each(sfmd.field_mapping)
                ) combined
            ),
            '{}'::jsonb
        ) as field_mapping
    FROM field_mapping_data fmd
    CROSS JOIN scenario_field_mapping_data sfmd
),
department_persona_ids AS (
    SELECT 
        d.id as department_id,
        COALESCE(ARRAY_AGG(p.id::text ORDER BY p.id) FILTER (WHERE p.id IS NOT NULL), ARRAY[]::text[]) as persona_ids
    FROM departments d
    CROSS JOIN user_departments ud
    LEFT JOIN personas p ON p.active = true
    LEFT JOIN persona_departments pd ON pd.persona_id = p.id AND pd.active = true
    WHERE d.id = ANY(ud.dept_ids)
    AND (
        pd.department_id = d.id 
        OR NOT EXISTS (SELECT 1 FROM persona_departments pd2 WHERE pd2.persona_id = p.id AND pd2.active = true)
    )
    AND (
        pd.department_id = ANY(ud.dept_ids)
        OR NOT EXISTS (SELECT 1 FROM persona_departments pd3 WHERE pd3.persona_id = p.id AND pd3.active = true)
    )
    GROUP BY d.id
),
department_document_ids AS (
    SELECT 
        d.id as department_id,
        COALESCE(ARRAY_AGG(doc.id::text ORDER BY doc.id) FILTER (WHERE doc.id IS NOT NULL), ARRAY[]::text[]) as document_ids
    FROM departments d
    CROSS JOIN user_departments ud
    LEFT JOIN documents doc ON doc.active = true
    LEFT JOIN document_departments dd ON dd.document_id = doc.id AND dd.active = true
    WHERE d.id = ANY(ud.dept_ids)
    AND (dd.department_id = d.id OR NOT EXISTS (SELECT 1 FROM document_departments dd2 WHERE dd2.document_id = doc.id AND dd2.active = true))
    GROUP BY d.id
),
department_parameter_ids AS (
    SELECT 
        d.id as department_id,
        COALESCE(ARRAY_AGG(DISTINCT p.id::text) FILTER (WHERE p.id IS NOT NULL), ARRAY[]::text[]) as parameter_ids
    FROM departments d
    CROSS JOIN user_departments ud
    LEFT JOIN parameters p ON p.active = true
    LEFT JOIN parameter_fields fp ON fp.parameter_id = p.id AND fp.active = true
    LEFT JOIN field_departments fd ON fd.field_id = fp.field_id AND fd.active = true
    WHERE d.id = ANY(ud.dept_ids)
    AND (fd.department_id = d.id OR NOT EXISTS (SELECT 1 FROM field_departments fd2 
                                                 JOIN parameter_fields fp2 ON fp2.field_id = fd2.field_id 
                                                 WHERE fp2.parameter_id = p.id AND fp2.active = true AND fd2.active = true))
    GROUP BY d.id
),
department_parameter_item_ids AS (
    SELECT 
        d.id as department_id,
        COALESCE(ARRAY_AGG(f.id::text ORDER BY f.id) FILTER (WHERE f.id IS NOT NULL), ARRAY[]::text[]) as parameter_item_ids
    FROM departments d
    CROSS JOIN user_departments ud
    LEFT JOIN fields f ON true
    LEFT JOIN parameter_fields fp ON fp.field_id = f.id AND fp.active = true
    LEFT JOIN parameters p ON p.id = fp.parameter_id AND p.active = true
    LEFT JOIN field_departments fd ON fd.field_id = f.id AND fd.active = true
    WHERE d.id = ANY(ud.dept_ids)
    AND p.id IS NOT NULL
    AND (
        fd.department_id = d.id 
        OR NOT EXISTS (SELECT 1 FROM field_departments fd2 WHERE fd2.field_id = f.id AND fd2.active = true)
    )
    AND (
        fd.department_id = ANY(ud.dept_ids)
        OR NOT EXISTS (SELECT 1 FROM field_departments fd3 WHERE fd3.field_id = f.id AND fd3.active = true)
    )
    GROUP BY d.id
),
department_mapping_data AS (
    SELECT COALESCE(jsonb_object_agg(
        d.id::text,
        jsonb_build_object(
            'name', d.title,
            'description', COALESCE(d.description, ''),
            'persona_ids', CASE WHEN dpi.persona_ids IS NOT NULL AND array_length(dpi.persona_ids, 1) > 0 THEN to_jsonb(dpi.persona_ids) ELSE NULL END,
            'document_ids', CASE WHEN ddi.document_ids IS NOT NULL AND array_length(ddi.document_ids, 1) > 0 THEN to_jsonb(ddi.document_ids) ELSE NULL END,
            'parameter_ids', CASE WHEN dparami.parameter_ids IS NOT NULL AND array_length(dparami.parameter_ids, 1) > 0 THEN to_jsonb(dparami.parameter_ids) ELSE NULL END,
            'parameter_item_ids', CASE WHEN dparamitems.parameter_item_ids IS NOT NULL AND array_length(dparamitems.parameter_item_ids, 1) > 0 THEN to_jsonb(dparamitems.parameter_item_ids) ELSE NULL END
        )
    ), '{}'::jsonb) as department_mapping
    FROM departments d
    CROSS JOIN user_departments ud
    LEFT JOIN department_persona_ids dpi ON dpi.department_id = d.id
    LEFT JOIN department_document_ids ddi ON ddi.department_id = d.id
    LEFT JOIN department_parameter_ids dparami ON dparami.department_id = d.id
    LEFT JOIN department_parameter_item_ids dparamitems ON dparamitems.department_id = d.id
    WHERE d.id = ANY(ud.dept_ids)
),
scenario_departments_mapping_data AS (
    SELECT COALESCE(
        jsonb_object_agg(
            d.id::text,
            jsonb_build_object(
                'name', d.title,
                'description', COALESCE(d.description, ''),
                'persona_ids', NULL,
                'document_ids', NULL,
                'parameter_ids', NULL,
                'parameter_item_ids', NULL
            )
        ),
        '{}'::jsonb
    ) as department_mapping
    FROM scenario_departments sd
    JOIN departments d ON d.id = sd.department_id
    WHERE sd.scenario_id = $1 AND sd.active = true AND d.active = true
),
enhanced_department_mapping_data AS (
    SELECT 
        COALESCE(
            jsonb_object_agg(
                dept_key,
                COALESCE(dmd.value, '{}'::jsonb) || 
                COALESCE(sdmdept.value, '{}'::jsonb) ||
                jsonb_build_object(
                    'persona_ids', COALESCE(dmd.value->'persona_ids', sdmdept.value->'persona_ids'),
                    'document_ids', COALESCE(dmd.value->'document_ids', sdmdept.value->'document_ids'),
                    'parameter_ids', COALESCE(dmd.value->'parameter_ids', sdmdept.value->'parameter_ids'),
                    'parameter_item_ids', COALESCE(dmd.value->'parameter_item_ids', sdmdept.value->'parameter_item_ids'),
                    'agent_ids', COALESCE(dmd.value->'agent_ids', sdmdept.value->'agent_ids'),
                    'staff_ids', COALESCE(dmd.value->'staff_ids', sdmdept.value->'staff_ids'),
                    'cohort_ids', COALESCE(dmd.value->'cohort_ids', sdmdept.value->'cohort_ids')
                )
            ),
            '{}'::jsonb
        ) as department_mapping
    FROM (
        SELECT DISTINCT dept_key
        FROM (
            SELECT key as dept_key FROM jsonb_each((SELECT department_mapping FROM department_mapping_data))
            UNION
            SELECT key as dept_key FROM jsonb_each((SELECT department_mapping FROM scenario_departments_mapping_data))
        ) all_keys
    ) keys
    LEFT JOIN LATERAL (
        SELECT value FROM jsonb_each((SELECT department_mapping FROM department_mapping_data)) WHERE key = keys.dept_key
    ) dmd ON true
    LEFT JOIN LATERAL (
        SELECT value FROM jsonb_each((SELECT department_mapping FROM scenario_departments_mapping_data)) WHERE key = keys.dept_key
    ) sdmdept ON true
),
accessible_scenarios AS (
    SELECT DISTINCT s.id as scenario_id
    FROM scenarios s
    LEFT JOIN scenario_departments sd ON sd.scenario_id = s.id AND sd.active = true
    CROSS JOIN user_departments ud
    WHERE s.active = true
    AND (
        sd.department_id = ANY(ud.dept_ids)
        OR NOT EXISTS (SELECT 1 FROM scenario_departments sd2 WHERE sd2.scenario_id = s.id AND sd2.active = true)
    )
),
objectives_with_departments AS (
    SELECT
        o.objective,
        COALESCE(
            (
                SELECT ARRAY_AGG(DISTINCT dept_id ORDER BY dept_id)
                FROM (
                    SELECT DISTINCT sd.department_id::text as dept_id
                    FROM scenario_objectives so2
                    JOIN objectives o2 ON o2.id = so2.objective_id
                    JOIN accessible_scenarios acs2 ON acs2.scenario_id = so2.scenario_id
                    LEFT JOIN scenario_departments sd ON sd.scenario_id = so2.scenario_id AND sd.active = true
                    WHERE o2.objective = o.objective
                        AND o2.objective IS NOT NULL 
                        AND o2.objective != ''
                        AND sd.department_id IS NOT NULL
                ) dept_list
            ),
            ARRAY[]::text[]
        ) as department_ids
    FROM scenario_objectives so
    JOIN objectives o ON o.id = so.objective_id
    JOIN accessible_scenarios acs ON acs.scenario_id = so.scenario_id
    WHERE o.objective IS NOT NULL AND o.objective != ''
    GROUP BY o.objective
),
objectives_history_data AS (
    SELECT COALESCE(
        (
            SELECT jsonb_agg(
                jsonb_build_object(
                    'objective', objective,
                    'department_ids', department_ids
                )
            )
            FROM (
                SELECT objective, department_ids
                FROM objectives_with_departments
                ORDER BY objective
            ) sorted
        ),
        '[]'::jsonb
    ) as objectives_history
),
user_departments_for_agents AS (
    SELECT department_id
    FROM resolve_profile_id rpi
    JOIN profile_departments pd ON pd.profile_id = rpi.resolved_profile_id
    WHERE pd.active = true
),
-- Check if any provided documentIds are templates
has_template_documents AS (
    SELECT 
        CASE 
            WHEN $5::uuid[] IS NOT NULL AND array_length($5::uuid[], 1) > 0 THEN
                EXISTS (
                    SELECT 1 
                    FROM documents d
                    WHERE d.id = ANY($5::uuid[])
                    AND (
                        d.template = true
                        OR EXISTS (
                            SELECT 1 
                            FROM document_templates dt 
                            WHERE dt.document_id = d.id 
                            AND dt.active = true
                        )
                    )
                )
            ELSE false
        END as has_templates
),
-- Determine expected agent role based on flags
expected_agent_role AS (
    SELECT get_scenario_agent_role(
        COALESCE($3::boolean, false),
        COALESCE($4::boolean, false),
        (SELECT has_templates FROM has_template_documents)
    ) as role
),
valid_agents AS (
    -- Filter agents by department access and expected role
    -- Include agents matching expected role OR base 'scenario' role (backward compatibility)
    -- AND always include image agents (for image agent picker)
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
        array_agg(a.id::text ORDER BY a.name) as agent_ids
    FROM agents a
    LEFT JOIN agent_departments ad ON ad.agent_id = a.id AND ad.active = true
    CROSS JOIN expected_agent_role ear
    WHERE a.active = true 
    AND (
        -- Match expected role OR base scenario role (backward compatibility)
        a.role = ear.role
        OR a.role = 'scenario'
        -- OR always include image agents (for image agent picker)
        OR a.role = 'image'
    )
    GROUP BY a.id, ear.role
    HAVING 
        COUNT(ad.agent_id) FILTER (WHERE ad.department_id IN (SELECT department_id FROM user_departments_for_agents)) > 0
        OR NOT EXISTS (SELECT 1 FROM agent_departments ad2 WHERE ad2.agent_id = a.id AND ad2.active = true)
)
SELECT 
    sc.id,
    sc.name,
    sc.problem_statement,
    sc.problem_statement_id,
    sc.active,
    sc.generated,
    sc.department_ids,
    sc.parent_scenario_id,
    COALESCE(ssa_attr.hints_enabled, false) as hints_enabled,
    sc.objectives_enabled,
    sc.image_enabled as image_input_enabled,
    COALESCE(spa.persona_ids, ARRAY[]::text[]) as persona_ids,
    COALESCE(sd.document_ids, ARRAY[]::text[]) as document_ids,
    COALESCE(sod.objective_ids, ARRAY[]::text[]) as objective_ids,
    COALESCE(ssa.simulation_ids, ARRAY[]::text[]) as simulation_ids,
    COALESCE(mpd.parameters_json, '{}'::jsonb) as parameters_json,
    COALESCE(vpd2.valid_persona_ids, ARRAY[]::text[]) as valid_persona_ids,
    COALESCE(vdd.valid_document_ids, ARRAY[]::text[]) as valid_document_ids,
    (SELECT dept_ids FROM user_departments) as valid_department_ids,
    COALESCE(ssa.active_usage_count, 0) as active_usage_count,
    up.role as user_role,
    sod.objective_mapping,
    vpd2.persona_mapping,
    COALESCE(edmd.document_mapping, vdd.document_mapping) as document_mapping,
    smd.simulation_mapping,
    COALESCE(epmd.parameter_mapping, pmd.parameter_mapping) as parameter_mapping,
    COALESCE(efmd.field_mapping, fmd.field_mapping) as field_mapping,
    COALESCE(edmdept.department_mapping, dmd.department_mapping) as department_mapping,
    ddd.document_details,
    COALESCE(psmd.problem_statement_mapping, '{}'::jsonb) as problem_statement_mapping,
    COALESCE(ohd.objectives_history, '[]'::jsonb) as objectives_history,
    COALESCE((SELECT scenario_images FROM scenario_images_data), '[]'::jsonb) as scenario_images,
    sc.scenario_agent_id,
    sc.image_agent_id,
    COALESCE((SELECT array_agg(parameter_id::text) FROM linked_scenario_parameters), ARRAY[]::text[]) as parameter_ids
FROM scenario_core sc
CROSS JOIN user_profile up
LEFT JOIN scenario_simulation_attributes ssa_attr ON ssa_attr.scenario_id = sc.id
LEFT JOIN scenario_personas_agg spa ON true
LEFT JOIN scenario_documents_agg sd ON true
LEFT JOIN scenario_objectives_data sod ON true
LEFT JOIN scenario_simulations_agg ssa ON true
CROSS JOIN merged_parameters_data mpd
CROSS JOIN valid_personas_data vpd2
CROSS JOIN valid_documents_data vdd
CROSS JOIN scenario_documents_mapping_data sdmd
CROSS JOIN enhanced_document_mapping_data edmd
CROSS JOIN document_details_data ddd
CROSS JOIN simulation_mapping_data smd
CROSS JOIN parameter_mapping_data pmd
CROSS JOIN scenario_parameters_mapping_data spmd
CROSS JOIN enhanced_parameter_mapping_data epmd
CROSS JOIN field_mapping_data fmd
CROSS JOIN scenario_field_mapping_data sfmd
CROSS JOIN enhanced_field_mapping_data efmd
CROSS JOIN department_mapping_data dmd
CROSS JOIN scenario_departments_mapping_data sdmdept
CROSS JOIN enhanced_department_mapping_data edmdept
CROSS JOIN problem_statement_mapping_data psmd
CROSS JOIN objectives_history_data ohd
CROSS JOIN valid_agents va

