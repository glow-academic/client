-- Get scenario detail with departments, problem statements, and access control
-- Parameters: $1 = scenario_id (uuid), $2 = profile_id (uuid or "guest-profile-id")

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
            jsonb_object_agg(
                sps.problem_statement_id,
                jsonb_build_object(
                    'problem_statement', sps.problem_statement,
                    'created_at', sps.problem_statement_created_at::text,
                    'updated_at', sps.problem_statement_updated_at::text
                )
            ),
            '{}'::jsonb
        ) as problem_statement_mapping
    FROM scenario_all_problem_statements sps
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
        s.hints_enabled,
        s.objectives_enabled,
        s.image_input_enabled,
        s.input_guardrail_enabled,
        s.output_guardrail_enabled
    FROM scenarios s
    LEFT JOIN scenario_tree st ON st.child_id = s.id AND st.parent_id != st.child_id
    LEFT JOIN scenario_active_problem_statement saps ON saps.scenario_id = s.id
    LEFT JOIN scenario_departments_data sdd ON sdd.scenario_id = s.id
    INNER JOIN scenario_department_access_check sdac ON sdac.scenario_id = s.id AND sdac.has_access = true
    WHERE s.id = $1
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
                'id', i.id::text,
                'name', i.name,
                'file_path', i.file_path,
                'mime_type', i.mime_type,
                'active', si.active
            )
        ) FILTER (WHERE i.id IS NOT NULL),
        '[]'::jsonb
    ) as scenario_images
    FROM scenario_images si
    JOIN images i ON i.id = si.image_id
    WHERE si.scenario_id = $1 AND si.active = true AND i.active = true
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
            SELECT jsonb_agg(spi2.parameter_item_id::text ORDER BY spi2.parameter_item_id)
            FROM scenario_parameter_items spi2
            JOIN parameter_items pi2 ON pi2.id = spi2.parameter_item_id
            WHERE spi2.scenario_id = $1 AND pi2.parameter_id = p.id AND spi2.active = true
        ), '[]'::jsonb) as selected_items,
        COALESCE((
            SELECT jsonb_agg(id::text ORDER BY id::text)
            FROM (
                SELECT pi3.id
                FROM parameter_items pi3
                LEFT JOIN parameter_item_departments pid3 ON pid3.parameter_item_id = pi3.id AND pid3.active = true
                CROSS JOIN user_departments ud3
                WHERE pi3.parameter_id = p.id
                GROUP BY pi3.id
                HAVING 
                    COUNT(pid3.parameter_item_id) FILTER (WHERE pid3.department_id = ANY(ud3.dept_ids)) > 0
                    OR NOT EXISTS (SELECT 1 FROM parameter_item_departments pid4 WHERE pid4.parameter_item_id = pi3.id AND pid4.active = true)
                UNION
                SELECT spi2.parameter_item_id as id
                FROM scenario_parameter_items spi2
                JOIN parameter_items pi2 ON pi2.id = spi2.parameter_item_id
                WHERE spi2.scenario_id = $1 AND pi2.parameter_id = p.id AND spi2.active = true
            ) combined_items
        ), '[]'::jsonb) as valid_items
    FROM parameters p
    JOIN parameter_items pi ON pi.parameter_id = p.id
    LEFT JOIN parameter_item_departments pid ON pid.parameter_item_id = pi.id AND pid.active = true
    CROSS JOIN user_departments ud
    WHERE p.active = true
    GROUP BY p.id
    HAVING 
        COUNT(pid.parameter_item_id) FILTER (WHERE pid.department_id = ANY(ud.dept_ids)) > 0
        OR NOT EXISTS (SELECT 1 FROM parameter_item_departments pid2 
                      JOIN parameter_items pi2 ON pi2.id = pid2.parameter_item_id 
                      WHERE pi2.parameter_id = p.id AND pid2.active = true)
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
valid_personas_filtered AS (
    SELECT DISTINCT
        p.id,
        p.name,
        COALESCE(p.description, '') as description,
        p.color,
        p.icon,
        m.image_model
    FROM personas p
    LEFT JOIN models m ON m.id = p.model_id
    LEFT JOIN persona_departments pd ON pd.persona_id = p.id AND pd.active = true
    CROSS JOIN user_departments ud
    WHERE p.active = true
    GROUP BY p.id, p.name, p.description, p.color, p.icon, m.image_model
    HAVING 
        COUNT(pd.persona_id) FILTER (WHERE pd.department_id = ANY(ud.dept_ids)) > 0
        OR NOT EXISTS (SELECT 1 FROM persona_departments pd2 WHERE pd2.persona_id = p.id AND pd2.active = true)
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
        m2.image_model
    FROM scenario_personas_agg spa
    CROSS JOIN LATERAL unnest(spa.persona_ids) as persona_id
    JOIN personas p2 ON p2.id = persona_id::uuid
    LEFT JOIN models m2 ON m2.id = p2.model_id
    WHERE p2.active = true
    ORDER BY name
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
    FROM persona_data p
),
valid_documents_filtered AS (
    SELECT DISTINCT
        d.id,
        d.name,
        d.type::text as description,
        d.file_path,
        d.mime_type
    FROM documents d
    LEFT JOIN document_departments dd ON dd.document_id = d.id AND dd.active = true
    CROSS JOIN user_departments ud
    WHERE d.active = true
    GROUP BY d.id, d.name, d.type, d.file_path, d.mime_type
    HAVING 
        COUNT(dd.document_id) FILTER (WHERE dd.department_id = ANY(ud.dept_ids)) > 0
        OR NOT EXISTS (SELECT 1 FROM document_departments dd2 WHERE dd2.document_id = d.id AND dd2.active = true)
),
document_data AS (
    SELECT * FROM valid_documents_filtered
    UNION
    SELECT DISTINCT
        d2.id,
        d2.name,
        d2.type::text as description,
        d2.file_path,
        d2.mime_type
    FROM scenario_documents_agg sda
    CROSS JOIN LATERAL unnest(sda.document_ids) as doc_id
    JOIN documents d2 ON d2.id = doc_id::uuid
    WHERE d2.active = true
    ORDER BY name
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
                'mimeType', d.mime_type
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
                'description', COALESCE(d.type::text, ''),
                'filePath', d.file_path,
                'mimeType', d.mime_type
            )
        ),
        '{}'::jsonb
    ) as document_mapping
    FROM scenario_documents sd
    JOIN documents d ON d.id = sd.document_id
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
                    'type', d.type,
                    'updatedAt', d.updated_at::text,
                    'extension', SUBSTRING(d.file_path FROM '\\.([^\\.]+)$'),
                    'scenario_ids', COALESCE((
                        SELECT jsonb_agg(sd2.scenario_id::text)
                        FROM scenario_documents sd2
                        WHERE sd2.document_id = d.id AND sd2.active = true
                    ), '[]'::jsonb),
                    'can_edit', true,
                    'can_delete', true,
                    'active', d.active,
                    'file_path', d.file_path,
                    'mime_type', d.mime_type,
                    'parameter_item_ids', COALESCE((
                        SELECT jsonb_agg(dpi.parameter_item_id::text)
                        FROM document_parameter_items dpi
                        WHERE dpi.document_id = d.id AND dpi.active = true
                    ), '[]'::jsonb)
                ) ORDER BY d.name
            )
            FROM scenario_documents sd
            JOIN documents d ON d.id = sd.document_id
            WHERE sd.scenario_id = $1 AND sd.active = true
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
parameter_data_for_mapping AS (
    SELECT DISTINCT 
        p.id,
        p.name,
        COALESCE(p.description, '') as description,
        p.numerical
    FROM parameters p
    JOIN parameter_items pi ON pi.parameter_id = p.id
    LEFT JOIN parameter_item_departments pid ON pid.parameter_item_id = pi.id AND pid.active = true
    CROSS JOIN user_departments ud
    WHERE p.active = true
    GROUP BY p.id, p.name, p.description, p.numerical
    HAVING 
        COUNT(pid.parameter_item_id) FILTER (WHERE pid.department_id = ANY(ud.dept_ids)) > 0
        OR NOT EXISTS (SELECT 1 FROM parameter_item_departments pid2 
                      JOIN parameter_items pi2 ON pi2.id = pid2.parameter_item_id 
                      WHERE pi2.parameter_id = p.id AND pid2.active = true)
    ORDER BY p.name
),
parameter_mapping_data AS (
    SELECT 
        COALESCE(jsonb_object_agg(
            p.id::text,
            jsonb_build_object('name', p.name, 'description', p.description, 'numerical', p.numerical)
        ), '{}'::jsonb) as parameter_mapping
    FROM parameter_data_for_mapping p
),
scenario_parameters_mapping_data AS (
    SELECT COALESCE(
        jsonb_object_agg(
            p.id::text,
            jsonb_build_object('name', p.name, 'description', COALESCE(p.description, ''), 'numerical', p.numerical)
        ),
        '{}'::jsonb
    ) as parameter_mapping
    FROM scenario_parameter_items spi
    JOIN parameter_items pi ON pi.id = spi.parameter_item_id
    JOIN parameters p ON p.id = pi.parameter_id
    WHERE spi.scenario_id = $1 AND spi.active = true AND p.active = true
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
parameter_item_data AS (
    SELECT 
        pi.id,
        pi.name,
        COALESCE(pi.description, '') as description,
        pi.parameter_id,
        p.name as parameter_name,
        pi.value
    FROM parameter_items pi
    JOIN parameters p ON p.id = pi.parameter_id
    LEFT JOIN parameter_item_departments pid ON pid.parameter_item_id = pi.id AND pid.active = true
    CROSS JOIN user_departments ud
    WHERE p.active = true
    GROUP BY pi.id, pi.name, pi.description, pi.parameter_id, p.id, p.name, pi.value
    HAVING 
        COUNT(pid.parameter_item_id) FILTER (WHERE pid.department_id = ANY(ud.dept_ids)) > 0
        OR NOT EXISTS (SELECT 1 FROM parameter_item_departments pid2 WHERE pid2.parameter_item_id = pi.id AND pid2.active = true)
    ORDER BY p.name, pi.name
),
parameter_item_mapping_data AS (
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
    FROM parameter_item_data pi
),
scenario_parameter_items_mapping_data AS (
    SELECT COALESCE(
        jsonb_object_agg(
            pi.id::text,
            jsonb_build_object(
                'name', pi.name,
                'description', COALESCE(pi.description, ''),
                'parameter_id', pi.parameter_id::text,
                'parameter_name', p.name,
                'value', pi.value
            )
        ),
        '{}'::jsonb
    ) as parameter_item_mapping
    FROM scenario_parameter_items spi
    JOIN parameter_items pi ON pi.id = spi.parameter_item_id
    JOIN parameters p ON p.id = pi.parameter_id
    WHERE spi.scenario_id = $1 AND spi.active = true AND p.active = true
),
enhanced_parameter_item_mapping_data AS (
    SELECT 
        COALESCE(
            (
                SELECT jsonb_object_agg(key, value)
                FROM (
                    SELECT key, value 
                    FROM jsonb_each(pimd.parameter_item_mapping)
                    UNION ALL
                    SELECT key, value 
                    FROM jsonb_each(spimd.parameter_item_mapping)
                ) combined
            ),
            '{}'::jsonb
        ) as parameter_item_mapping
    FROM parameter_item_mapping_data pimd
    CROSS JOIN scenario_parameter_items_mapping_data spimd
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
    LEFT JOIN parameter_items pi ON pi.parameter_id = p.id
    LEFT JOIN parameter_item_departments pid ON pid.parameter_item_id = pi.id AND pid.active = true
    WHERE d.id = ANY(ud.dept_ids)
    AND (pid.department_id = d.id OR NOT EXISTS (SELECT 1 FROM parameter_item_departments pid2 
                                                 JOIN parameter_items pi2 ON pi2.id = pid2.parameter_item_id 
                                                 WHERE pi2.parameter_id = p.id AND pid2.active = true))
    GROUP BY d.id
),
department_parameter_item_ids AS (
    SELECT 
        d.id as department_id,
        COALESCE(ARRAY_AGG(pi.id::text ORDER BY pi.id) FILTER (WHERE pi.id IS NOT NULL), ARRAY[]::text[]) as parameter_item_ids
    FROM departments d
    CROSS JOIN user_departments ud
    LEFT JOIN parameter_items pi ON true
    LEFT JOIN parameters p ON p.id = pi.parameter_id AND p.active = true
    LEFT JOIN parameter_item_departments pid ON pid.parameter_item_id = pi.id AND pid.active = true
    WHERE d.id = ANY(ud.dept_ids)
    AND p.id IS NOT NULL
    AND (
        pid.department_id = d.id 
        OR NOT EXISTS (SELECT 1 FROM parameter_item_departments pid2 WHERE pid2.parameter_item_id = pi.id AND pid2.active = true)
    )
    AND (
        pid.department_id = ANY(ud.dept_ids)
        OR NOT EXISTS (SELECT 1 FROM parameter_item_departments pid3 WHERE pid3.parameter_item_id = pi.id AND pid3.active = true)
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
    sc.hints_enabled,
    sc.objectives_enabled,
    sc.image_input_enabled,
    sc.input_guardrail_enabled,
    sc.output_guardrail_enabled,
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
    COALESCE(epimd.parameter_item_mapping, pimd.parameter_item_mapping) as parameter_item_mapping,
    COALESCE(edmdept.department_mapping, dmd.department_mapping) as department_mapping,
    ddd.document_details,
    COALESCE(psmd.problem_statement_mapping, '{}'::jsonb) as problem_statement_mapping,
    COALESCE(ohd.objectives_history, '[]'::jsonb) as objectives_history,
    COALESCE((SELECT scenario_images FROM scenario_images_data), '[]'::jsonb) as scenario_images
FROM scenario_core sc
CROSS JOIN user_profile up
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
CROSS JOIN parameter_item_mapping_data pimd
CROSS JOIN scenario_parameter_items_mapping_data spimd
CROSS JOIN enhanced_parameter_item_mapping_data epimd
CROSS JOIN department_mapping_data dmd
CROSS JOIN scenario_departments_mapping_data sdmdept
CROSS JOIN enhanced_department_mapping_data edmdept
CROSS JOIN problem_statement_mapping_data psmd
CROSS JOIN objectives_history_data ohd

