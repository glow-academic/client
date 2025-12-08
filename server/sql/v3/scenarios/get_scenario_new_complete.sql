WITH user_departments AS (
    SELECT DISTINCT d.id
    FROM departments d
    JOIN profile_departments pd ON pd.department_id = d.id
    WHERE pd.profile_id = $1 AND pd.active = true AND d.active = true
),
department_persona_ids AS (
    SELECT 
        d.id as department_id,
        COALESCE(ARRAY_AGG(p.id::text ORDER BY p.id) FILTER (WHERE p.id IS NOT NULL), ARRAY[]::text[]) as persona_ids
    FROM departments d
    INNER JOIN user_departments ud ON d.id = ud.id
    LEFT JOIN personas p ON p.active = true
    LEFT JOIN persona_departments pd ON pd.persona_id = p.id AND pd.active = true
    WHERE (
        pd.department_id = d.id 
        OR NOT EXISTS (SELECT 1 FROM persona_departments pd2 WHERE pd2.persona_id = p.id AND pd2.active = true)
    )
    GROUP BY d.id
),
department_document_ids AS (
    SELECT 
        d.id as department_id,
        COALESCE(ARRAY_AGG(doc.id::text ORDER BY doc.id) FILTER (WHERE doc.id IS NOT NULL), ARRAY[]::text[]) as document_ids
    FROM departments d
    INNER JOIN user_departments ud ON d.id = ud.id
    LEFT JOIN documents doc ON doc.active = true
    LEFT JOIN document_departments dd ON dd.document_id = doc.id AND dd.active = true
    WHERE (dd.department_id = d.id OR NOT EXISTS (SELECT 1 FROM document_departments dd2 WHERE dd2.document_id = doc.id AND dd2.active = true))
    GROUP BY d.id
),
department_parameter_ids AS (
    SELECT 
        d.id as department_id,
        COALESCE(ARRAY_AGG(DISTINCT p.id::text) FILTER (WHERE p.id IS NOT NULL), ARRAY[]::text[]) as parameter_ids
    FROM departments d
    INNER JOIN user_departments ud ON d.id = ud.id
    LEFT JOIN parameters p ON p.active = true
    LEFT JOIN parameter_fields pf ON pf.parameter_id = p.id AND pf.active = true
    LEFT JOIN field_departments fd ON fd.field_id = pf.field_id AND fd.active = true
    WHERE (fd.department_id = d.id OR NOT EXISTS (SELECT 1 FROM field_departments fd2 
                                                 JOIN parameter_fields pf2 ON pf2.field_id = fd2.field_id 
                                                 WHERE pf2.parameter_id = p.id AND pf2.active = true AND fd2.active = true))
    GROUP BY d.id
),
department_parameter_item_ids AS (
    SELECT 
        d.id as department_id,
        COALESCE(ARRAY_AGG(f.id::text ORDER BY f.id) FILTER (WHERE f.id IS NOT NULL), ARRAY[]::text[]) as parameter_item_ids
    FROM departments d
    INNER JOIN user_departments ud ON d.id = ud.id
    LEFT JOIN fields f ON true
    LEFT JOIN field_departments fd ON fd.field_id = f.id AND fd.active = true
    WHERE (
        fd.department_id = d.id 
        OR NOT EXISTS (SELECT 1 FROM field_departments fd2 WHERE fd2.field_id = f.id AND fd2.active = true)
    )
    GROUP BY d.id
),
department_mapping_data AS (
    SELECT COALESCE(
        jsonb_object_agg(
            d.id::text,
            jsonb_build_object(
                'name', d.title,
                'description', COALESCE(d.description, ''),
                'persona_ids', CASE WHEN dpi.persona_ids IS NOT NULL AND array_length(dpi.persona_ids, 1) > 0 THEN to_jsonb(dpi.persona_ids) ELSE NULL END,
                'document_ids', CASE WHEN ddi.document_ids IS NOT NULL AND array_length(ddi.document_ids, 1) > 0 THEN to_jsonb(ddi.document_ids) ELSE NULL END,
                'parameter_ids', CASE WHEN dparami.parameter_ids IS NOT NULL AND array_length(dparami.parameter_ids, 1) > 0 THEN to_jsonb(dparami.parameter_ids) ELSE NULL END,
                'parameter_item_ids', CASE WHEN dparamitems.parameter_item_ids IS NOT NULL AND array_length(dparamitems.parameter_item_ids, 1) > 0 THEN to_jsonb(dparamitems.parameter_item_ids) ELSE NULL END
            )
        ),
        '{}'::jsonb
    ) as mapping
    FROM departments d
    INNER JOIN user_departments ud ON d.id = ud.id
    LEFT JOIN department_persona_ids dpi ON dpi.department_id = d.id
    LEFT JOIN department_document_ids ddi ON ddi.department_id = d.id
    LEFT JOIN department_parameter_ids dparami ON dparami.department_id = d.id
    LEFT JOIN department_parameter_item_ids dparamitems ON dparamitems.department_id = d.id
),
image_model_check AS (
    SELECT 
        model_id,
        CASE WHEN COUNT(*) > 0 THEN true ELSE false END as image_model
    FROM model_modalities
    WHERE modality = 'image' AND is_input = false AND active = true
    GROUP BY model_id
),
persona_data AS (
    SELECT 
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
    WHERE p.active = true
    GROUP BY p.id, p.name, p.description, p.color, p.icon, imc.image_model
    HAVING 
        COUNT(pd.persona_id) FILTER (WHERE pd.department_id IN (SELECT id FROM user_departments)) > 0
        OR NOT EXISTS (SELECT 1 FROM persona_departments pd2 WHERE pd2.persona_id = p.id AND pd2.active = true)
    ORDER BY p.name
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
persona_parameter_mapping AS (
    SELECT COALESCE(
        jsonb_object_agg(
            ppr.persona_id::text,
            COALESCE(
                (SELECT jsonb_agg(ppr2.parameter_id::text ORDER BY ppr2.parameter_id)
                 FROM persona_parameter_relationships ppr2
                 WHERE ppr2.persona_id = ppr.persona_id),
                '[]'::jsonb
            )
        ),
        '{}'::jsonb
    ) as mapping
    FROM persona_parameter_relationships ppr
),
persona_mapping_data AS (
    SELECT COALESCE(
        jsonb_object_agg(
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
        ),
        '{}'::jsonb
    ) as mapping
    FROM persona_data p
),
document_data AS (
    SELECT 
        d.id,
        d.name,
        ''::text as description
    FROM documents d
    LEFT JOIN document_departments dd ON dd.document_id = d.id AND dd.active = true
    WHERE d.active = true
    GROUP BY d.id, d.name
    HAVING 
        COUNT(dd.document_id) FILTER (WHERE dd.department_id IN (SELECT id FROM user_departments)) > 0
        OR NOT EXISTS (SELECT 1 FROM document_departments dd2 WHERE dd2.document_id = d.id AND dd2.active = true)
    ORDER BY d.name
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
                )
            )
        ),
        '{}'::jsonb
    ) as mapping
    FROM document_data d
),
available_scenario_parameters AS (
    -- Get all parameters that could be linked to scenarios (via scenario_parameters)
    -- For new scenarios, show all active parameters that are linked to at least one scenario
    SELECT DISTINCT
        p.id,
        p.name,
        COALESCE(p.description, '') as description,
        CASE WHEN EXISTS (SELECT 1 FROM parameter_documents pd WHERE pd.parameter_id = p.id AND pd.active = true) THEN true ELSE false END as document_parameter,
        CASE WHEN EXISTS (SELECT 1 FROM parameter_personas pp WHERE pp.parameter_id = p.id AND pp.active = true) THEN true ELSE false END as persona_parameter
    FROM parameters p
    WHERE p.active = true
    AND EXISTS (
        SELECT 1 FROM scenario_parameters sp 
        WHERE sp.parameter_id = p.id 
        AND sp.active = true
    )
),
parameter_data AS (
    SELECT DISTINCT 
        p.id,
        p.name,
        COALESCE(p.description, '') as description,
        CASE WHEN EXISTS (SELECT 1 FROM parameter_documents pd WHERE pd.parameter_id = p.id AND pd.active = true) THEN true ELSE false END as document_parameter,
        CASE WHEN EXISTS (SELECT 1 FROM parameter_personas pp WHERE pp.parameter_id = p.id AND pp.active = true) THEN true ELSE false END as persona_parameter
    FROM parameters p
    JOIN parameter_fields pf ON pf.parameter_id = p.id AND pf.active = true
    LEFT JOIN field_departments fd ON fd.field_id = pf.field_id AND fd.active = true
    CROSS JOIN user_departments ud
    WHERE p.active = true
    GROUP BY p.id, p.name, p.description
    HAVING 
        COUNT(fd.field_id) FILTER (WHERE fd.department_id = ANY(SELECT id FROM user_departments)) > 0
        OR NOT EXISTS (SELECT 1 FROM field_departments fd2 
                      JOIN parameter_fields pf2 ON pf2.field_id = fd2.field_id 
                      WHERE pf2.parameter_id = p.id AND pf2.active = true)
    ORDER BY p.name
),
parameter_mapping_data AS (
    SELECT COALESCE(
        jsonb_object_agg(
            p.id::text,
            jsonb_build_object(
                'name', p.name,
                'description', p.description,
                'document_parameter', p.document_parameter,
                'persona_parameter', p.persona_parameter
            )
        ),
        '{}'::jsonb
    ) as mapping,
    array_agg(p.id::text ORDER BY p.name) as parameter_ids
    FROM available_scenario_parameters p
),
parameter_item_data AS (
    SELECT 
        f.id,
        f.name,
        COALESCE(f.description, '') as description,
        pf.parameter_id,
        p.name as parameter_name
    FROM fields f
    JOIN parameter_fields pf ON pf.field_id = f.id AND pf.active = true
    JOIN parameters p ON p.id = pf.parameter_id
    LEFT JOIN field_departments fd ON fd.field_id = f.id AND fd.active = true
    WHERE p.active = true AND f.active = true
    GROUP BY f.id, f.name, f.description, pf.parameter_id, p.id, p.name
    HAVING 
        COUNT(fd.field_id) FILTER (WHERE fd.department_id IN (SELECT id FROM user_departments)) > 0
        OR NOT EXISTS (SELECT 1 FROM field_departments fd2 WHERE fd2.field_id = f.id AND fd2.active = true)
    ORDER BY p.name, f.name
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
parameter_item_mapping_data AS (
    SELECT COALESCE(
        jsonb_object_agg(
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
        ),
        '{}'::jsonb
    ) as mapping
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
parameters_structure AS (
    SELECT COALESCE(
        jsonb_object_agg(
            pd.id::text,
            jsonb_build_object(
                'parameter_item_ids', '[]'::jsonb,
                'valid_parameter_item_ids', COALESCE((
                    SELECT jsonb_agg(f.id::text ORDER BY f.id)
                    FROM fields f
                    JOIN parameter_fields pf ON pf.field_id = f.id AND pf.active = true
                    WHERE pf.parameter_id = pd.id AND f.active = true
                ), '[]'::jsonb)
            )
        ),
        '{}'::jsonb
    ) as parameters_json
    FROM parameter_data pd
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
                    'scenario_ids', '[]'::jsonb,
                    'can_edit', true,
                    'can_delete', true,
                    'active', d.active,
                    'file_path', u.file_path,
                    'mime_type', u.mime_type,
                    'parameter_item_ids', COALESCE((
                        SELECT jsonb_agg(df.field_id::text)
                        FROM document_fields df
                        WHERE df.document_id = d.id AND df.active = true
                    ), '[]'::jsonb)
                ) ORDER BY d.name
            )
            FROM documents d
            LEFT JOIN document_uploads du ON du.document_id = d.id AND du.active = true
            LEFT JOIN uploads u ON u.id = du.upload_id
            WHERE d.id IN (SELECT id FROM document_data)
            AND d.active = true
        ),
        '[]'::jsonb
    ) as document_details
),
accessible_scenarios_default AS (
    SELECT DISTINCT s.id as scenario_id
    FROM scenarios s
    LEFT JOIN scenario_departments sd ON sd.scenario_id = s.id AND sd.active = true
    WHERE s.active = true
    AND (
        sd.department_id IN (SELECT id FROM user_departments)
        OR NOT EXISTS (SELECT 1 FROM scenario_departments sd2 WHERE sd2.scenario_id = s.id AND sd2.active = true)
    )
),
objectives_with_departments_default AS (
    SELECT
        o.objective,
        COALESCE(
            (
                SELECT ARRAY_AGG(DISTINCT dept_id ORDER BY dept_id)
                FROM (
                    SELECT DISTINCT sd.department_id::text as dept_id
                    FROM scenario_objectives so2
                    JOIN objectives o2 ON o2.id = so2.objective_id
                    JOIN accessible_scenarios_default acs2 ON acs2.scenario_id = so2.scenario_id
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
    JOIN accessible_scenarios_default acs ON acs.scenario_id = so.scenario_id
    WHERE o.objective IS NOT NULL AND o.objective != ''
    GROUP BY o.objective
),
objectives_history_data_default AS (
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
                FROM objectives_with_departments_default
                ORDER BY objective
            ) sorted
        ),
        '[]'::jsonb
    ) as objectives_history
),
problem_statement_mapping_data_default AS (
    SELECT '{}'::jsonb as problem_statement_mapping
),
user_profile AS (
    SELECT role as user_role 
    FROM profiles 
    WHERE id = $1
),
primary_department_id AS (
    SELECT department_id::text
    FROM profile_departments
    WHERE profile_id = $1 AND is_primary = TRUE
    LIMIT 1
),
first_user_department AS (
    SELECT ud.id
    FROM user_departments ud
    ORDER BY ud.id
    LIMIT 1
),
resolved_department_for_agents AS (
    -- Use primary department if available, otherwise first accessible department
    SELECT COALESCE(
        (SELECT pd.department_id FROM profile_departments pd WHERE pd.profile_id = $1 AND pd.is_primary = TRUE LIMIT 1),
        (SELECT id FROM first_user_department)
    ) as department_id
),
default_scenario_agent AS (
    -- Get best scenario agent for the resolved department
    SELECT a.id::text as agent_id
    FROM agents a
    LEFT JOIN agent_departments ad ON ad.agent_id = a.id AND ad.active = true
    CROSS JOIN resolved_department_for_agents rdfa
    WHERE a.role = 'scenario'
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
agent_filtered AS (
    -- Filter agents by department access
    SELECT a.id, a.name, a.description, a.role
    FROM agents a
    LEFT JOIN agent_departments ad ON ad.agent_id = a.id AND ad.active = true
    WHERE a.active = true 
    AND a.role IN ('scenario', 'image')
    GROUP BY a.id, a.name, a.description, a.role
    HAVING 
        COUNT(ad.agent_id) FILTER (WHERE ad.department_id IN (SELECT id FROM user_departments)) > 0
        OR NOT EXISTS (SELECT 1 FROM agent_departments ad2 WHERE ad2.agent_id = a.id AND ad2.active = true)
),
valid_agents AS (
    -- Aggregate all filtered agents into a single row
    SELECT 
        COALESCE(
            jsonb_object_agg(
                af.id::text,
                jsonb_build_object(
                    'name', af.name,
                    'description', COALESCE(af.description, ''),
                    'roles', ARRAY[af.role::text]
                )
            ),
            '{}'::jsonb
        ) as agent_mapping,
        COALESCE(array_agg(af.id::text ORDER BY af.name), ARRAY[]::text[]) as agent_ids
    FROM agent_filtered af
)
SELECT 
    COALESCE(
        (SELECT array_agg(id::text ORDER BY id) FROM user_departments),
        ARRAY[]::text[]
    ) as department_ids,
    COALESCE(
        (SELECT array_agg(id::text) FROM persona_data),
        ARRAY[]::text[]
    ) as valid_persona_ids,
    COALESCE(
        (SELECT array_agg(id::text) FROM document_data),
        ARRAY[]::text[]
    ) as valid_document_ids,
    (SELECT mapping FROM department_mapping_data) as department_mapping,
    (SELECT mapping FROM persona_mapping_data) as persona_mapping,
    (SELECT mapping FROM document_mapping_data) as document_mapping,
    (SELECT mapping FROM parameter_mapping_data) as parameter_mapping,
    (SELECT parameter_ids FROM parameter_mapping_data) as valid_parameter_ids,
    (SELECT mapping FROM parameter_item_mapping_data) as parameter_item_mapping,
    (SELECT parameters_json FROM parameters_structure) as parameters_json,
    (SELECT document_details FROM document_details_data) as document_details,
    (SELECT problem_statement_mapping FROM problem_statement_mapping_data_default) as problem_statement_mapping,
    (SELECT objectives_history FROM objectives_history_data_default) as objectives_history,
    (SELECT user_role FROM user_profile) as user_role,
    (SELECT department_id FROM primary_department_id) as primary_department_id,
    COALESCE((SELECT agent_id FROM default_scenario_agent), '') as scenario_agent_id,
    COALESCE((SELECT agent_id FROM default_image_agent), '') as image_agent_id,
    COALESCE((SELECT agent_mapping FROM valid_agents), '{}'::jsonb) as agent_mapping,
    COALESCE((SELECT agent_ids FROM valid_agents), ARRAY[]::text[]) as valid_agent_ids

