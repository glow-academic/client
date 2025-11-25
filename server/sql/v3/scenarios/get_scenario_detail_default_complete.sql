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
    LEFT JOIN parameter_items pi ON pi.parameter_id = p.id
    LEFT JOIN parameter_item_departments pid ON pid.parameter_item_id = pi.id AND pid.active = true
    WHERE (pid.department_id = d.id OR NOT EXISTS (SELECT 1 FROM parameter_item_departments pid2 
                                                 JOIN parameter_items pi2 ON pi2.id = pid2.parameter_item_id 
                                                 WHERE pi2.parameter_id = p.id AND pid2.active = true))
    GROUP BY d.id
),
department_parameter_item_ids AS (
    SELECT 
        d.id as department_id,
        COALESCE(ARRAY_AGG(pi.id::text ORDER BY pi.id) FILTER (WHERE pi.id IS NOT NULL), ARRAY[]::text[]) as parameter_item_ids
    FROM departments d
    INNER JOIN user_departments ud ON d.id = ud.id
    LEFT JOIN parameter_items pi ON true
    LEFT JOIN parameter_item_departments pid ON pid.parameter_item_id = pi.id AND pid.active = true
    WHERE (
        pid.department_id = d.id 
        OR NOT EXISTS (SELECT 1 FROM parameter_item_departments pid2 WHERE pid2.parameter_item_id = pi.id AND pid2.active = true)
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
persona_data AS (
    SELECT 
        p.id,
        p.name,
        COALESCE(p.description, '') as description,
        p.color,
        p.icon,
        m.image_model
    FROM personas p
    LEFT JOIN persona_text_model ptm ON ptm.persona_id = p.id AND ptm.active = true
    LEFT JOIN models m ON m.id = ptm.model_id
    LEFT JOIN persona_departments pd ON pd.persona_id = p.id AND pd.active = true
    WHERE p.active = true
    GROUP BY p.id, p.name, p.description, p.color, p.icon, m.image_model
    HAVING 
        COUNT(pd.persona_id) FILTER (WHERE pd.department_id IN (SELECT id FROM user_departments)) > 0
        OR NOT EXISTS (SELECT 1 FROM persona_departments pd2 WHERE pd2.persona_id = p.id AND pd2.active = true)
    ORDER BY p.name
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
                'image_model', COALESCE(p.image_model, false)
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
        d.type::text as description
    FROM documents d
    LEFT JOIN document_departments dd ON dd.document_id = d.id AND dd.active = true
    WHERE d.active = true
    GROUP BY d.id, d.name, d.type
    HAVING 
        COUNT(dd.document_id) FILTER (WHERE dd.department_id IN (SELECT id FROM user_departments)) > 0
        OR NOT EXISTS (SELECT 1 FROM document_departments dd2 WHERE dd2.document_id = d.id AND dd2.active = true)
    ORDER BY d.name
),
document_mapping_data AS (
    SELECT COALESCE(
        jsonb_object_agg(
            d.id::text,
            jsonb_build_object(
                'name', d.name,
                'description', d.description
            )
        ),
        '{}'::jsonb
    ) as mapping
    FROM document_data d
),
parameter_data AS (
    SELECT DISTINCT 
        p.id,
        p.name,
        COALESCE(p.description, '') as description,
        p.numerical,
        p.document_parameter
    FROM parameters p
    JOIN parameter_items pi ON pi.parameter_id = p.id
    LEFT JOIN parameter_item_departments pid ON pid.parameter_item_id = pi.id AND pid.active = true
    WHERE p.active = true
    GROUP BY p.id, p.name, p.description, p.numerical, p.document_parameter
    HAVING 
        COUNT(pid.parameter_item_id) FILTER (WHERE pid.department_id IN (SELECT id FROM user_departments)) > 0
        OR NOT EXISTS (SELECT 1 FROM parameter_item_departments pid2 
                      JOIN parameter_items pi2 ON pi2.id = pid2.parameter_item_id 
                      WHERE pi2.parameter_id = p.id AND pid2.active = true)
    ORDER BY p.name
),
parameter_mapping_data AS (
    SELECT COALESCE(
        jsonb_object_agg(
            p.id::text,
            jsonb_build_object(
                'name', p.name,
                'description', p.description,
                'numerical', p.numerical,
                'document_parameter', p.document_parameter
            )
        ),
        '{}'::jsonb
    ) as mapping
    FROM parameter_data p
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
    WHERE p.active = true
    GROUP BY pi.id, pi.name, pi.description, pi.parameter_id, p.id, p.name, pi.value
    HAVING 
        COUNT(pid.parameter_item_id) FILTER (WHERE pid.department_id IN (SELECT id FROM user_departments)) > 0
        OR NOT EXISTS (SELECT 1 FROM parameter_item_departments pid2 WHERE pid2.parameter_item_id = pi.id AND pid2.active = true)
    ORDER BY p.name, pi.name
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
                'value', pi.value
            )
        ),
        '{}'::jsonb
    ) as mapping
    FROM parameter_item_data pi
),
parameters_structure AS (
    SELECT COALESCE(
        jsonb_object_agg(
            pd.id::text,
            jsonb_build_object(
                'parameter_item_ids', '[]'::jsonb,
                'valid_parameter_item_ids', COALESCE((
                    SELECT jsonb_agg(pi.id::text ORDER BY pi.id)
                    FROM parameter_items pi
                    WHERE pi.parameter_id = pd.id
                ), '[]'::jsonb)
            )
        ),
        '{}'::jsonb
    ) as parameters_json
    FROM parameter_data pd
),
document_details_data AS (
    SELECT '[]'::jsonb as document_details
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
    (SELECT mapping FROM parameter_item_mapping_data) as parameter_item_mapping,
    (SELECT parameters_json FROM parameters_structure) as parameters_json,
    (SELECT document_details FROM document_details_data) as document_details,
    (SELECT problem_statement_mapping FROM problem_statement_mapping_data_default) as problem_statement_mapping,
    (SELECT objectives_history FROM objectives_history_data_default) as objectives_history,
    (SELECT user_role FROM user_profile) as user_role,
    (SELECT department_id FROM primary_department_id) as primary_department_id

