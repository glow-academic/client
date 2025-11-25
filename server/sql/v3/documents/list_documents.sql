WITH user_departments AS (
    SELECT department_id
    FROM profile_departments
    WHERE profile_id = $1 AND active = true
),
document_active_scenario_links AS (
    SELECT 
        sd.document_id,
        COUNT(*) as active_scenario_count
    FROM scenario_documents sd
    WHERE sd.active = true
    GROUP BY sd.document_id
),
document_all_scenario_links AS (
    SELECT 
        sd.document_id,
        COUNT(*) as total_scenario_links
    FROM scenario_documents sd
    GROUP BY sd.document_id
),
document_scenarios AS (
    SELECT 
        sd.document_id,
        ARRAY_AGG(DISTINCT st.parent_id) as scenario_ids
    FROM scenario_documents sd
    JOIN scenario_tree st ON st.child_id = sd.scenario_id AND st.parent_id = st.child_id
    WHERE sd.active = true
    GROUP BY sd.document_id
),
document_parameter_items_cte AS (
    SELECT 
        dpi.document_id,
        ARRAY_AGG(dpi.parameter_item_id) as parameter_item_ids
    FROM document_parameter_items dpi
    WHERE dpi.active = true
    GROUP BY dpi.document_id
),
document_departments_data AS (
    SELECT 
        dd.document_id,
        ARRAY_AGG(dd.department_id::text ORDER BY dd.created_at) as department_ids
    FROM document_departments dd
    WHERE dd.active = true
    GROUP BY dd.document_id
),
document_data AS (
    SELECT 
        d.id as document_id,
        d.name,
        d.type,
        d.updated_at,
        d.mime_type,
        d.active,
        d.file_path,
        COALESCE(ddd.department_ids, NULL) as department_ids,
        COALESCE(ds.scenario_ids, ARRAY[]::uuid[]) as scenario_ids,
        COALESCE(dpic.parameter_item_ids, ARRAY[]::uuid[]) as parameter_item_ids,
        COALESCE(dasl.active_scenario_count, 0) as active_scenario_count,
        COALESCE(dasl_all.total_scenario_links, 0) as total_scenario_links
    FROM documents d
    LEFT JOIN document_departments dd ON dd.document_id = d.id AND dd.active = true
    LEFT JOIN document_departments_data ddd ON ddd.document_id = d.id
    LEFT JOIN document_scenarios ds ON ds.document_id = d.id
    LEFT JOIN document_parameter_items_cte dpic ON dpic.document_id = d.id
    LEFT JOIN document_active_scenario_links dasl ON dasl.document_id = d.id
    LEFT JOIN document_all_scenario_links dasl_all ON dasl_all.document_id = d.id
    GROUP BY d.id, d.name, d.type, d.updated_at, d.mime_type, d.active, d.file_path, 
             ddd.department_ids, ds.scenario_ids, dpic.parameter_item_ids, dasl.active_scenario_count, dasl_all.total_scenario_links
    HAVING 
        COUNT(dd.document_id) FILTER (WHERE dd.department_id IN (SELECT department_id FROM user_departments)) > 0
        OR NOT EXISTS (SELECT 1 FROM document_departments dd2 WHERE dd2.document_id = d.id AND dd2.active = true)
),
user_profile AS (
    SELECT role FROM profiles WHERE id = $1
),
all_scenario_ids AS (
    SELECT DISTINCT unnest(scenario_ids) as scenario_id
    FROM document_data
),
scenario_mapping_data AS (
    SELECT COALESCE(
        jsonb_object_agg(
            s.id::text,
            jsonb_build_object(
                'name', s.name,
                'description', COALESCE(ps.problem_statement, ''),
                'active', s.active,
                'persona_id', NULL,
                'persona_mapping', '{}'::jsonb,
                'document_mapping', '{}'::jsonb,
                'parameter_item_mapping', '{}'::jsonb,
                'parameter_item_ids', ARRAY[]::text[],
                'document_ids', ARRAY[]::text[]
            )
        ) FILTER (WHERE s.id IS NOT NULL),
        '{}'::jsonb
    ) as mapping
    FROM all_scenario_ids asi
    LEFT JOIN scenarios s ON s.id = asi.scenario_id
    LEFT JOIN scenario_problem_statements sps ON sps.scenario_id = s.id AND sps.active = true
    LEFT JOIN problem_statements ps ON ps.id = sps.problem_statement_id
    LEFT JOIN scenario_tree st ON st.parent_id = s.id AND st.child_id = s.id
),
parameter_item_mapping_data AS (
    SELECT COALESCE(
        jsonb_object_agg(
            pi.id::text,
            jsonb_build_object(
                'name', pi.name,
                'description', COALESCE(pi.description, ''),
                'parameter_id', pi.parameter_id::text,
                'parameter_name', pi.parameter_name,
                'value', COALESCE(pi.value, '')
            )
        ) FILTER (WHERE pi.id IS NOT NULL),
        '{}'::jsonb
    ) as mapping
    FROM (
        SELECT DISTINCT
            pi.id,
            pi.name,
            pi.description,
            pi.value,
            pi.parameter_id,
            p.name as parameter_name
        FROM parameter_items pi
        JOIN parameters p ON p.id = pi.parameter_id
        LEFT JOIN parameter_item_departments pid ON pid.parameter_item_id = pi.id AND pid.active = true
        WHERE p.active = true
        GROUP BY pi.id, pi.name, pi.description, pi.value, pi.parameter_id, p.name
        HAVING 
            COUNT(pid.parameter_item_id) FILTER (WHERE pid.department_id IN (SELECT department_id FROM user_departments)) > 0
            OR NOT EXISTS (SELECT 1 FROM parameter_item_departments pid2 WHERE pid2.parameter_item_id = pi.id AND pid2.active = true)
    ) pi
),
department_parameter_ids AS (
    SELECT 
        d.id as department_id,
        COALESCE(ARRAY_AGG(DISTINCT p.id::text) FILTER (WHERE p.id IS NOT NULL), ARRAY[]::text[]) as parameter_ids
    FROM departments d
    LEFT JOIN parameters p ON p.active = true
    LEFT JOIN parameter_items pi ON pi.parameter_id = p.id
    LEFT JOIN parameter_item_departments pid ON pid.parameter_item_id = pi.id AND pid.active = true
    WHERE d.id IN (SELECT department_id FROM user_departments)
    AND (pid.department_id = d.id OR NOT EXISTS (SELECT 1 FROM parameter_item_departments pid2 
                                                 JOIN parameter_items pi2 ON pi2.id = pid2.parameter_item_id 
                                                 WHERE pi2.parameter_id = p.id AND pid2.active = true))
    GROUP BY d.id
),
cross_department_items AS (
    -- Parameter items with no department restrictions (available to all)
    SELECT DISTINCT pi.id
    FROM parameter_items pi
    JOIN parameters p ON p.id = pi.parameter_id AND p.active = true
    WHERE NOT EXISTS (
        SELECT 1 FROM parameter_item_departments pid 
        WHERE pid.parameter_item_id = pi.id 
        AND pid.active = true
    )
),
department_parameter_item_ids AS (
    SELECT 
        d.id as department_id,
        COALESCE(ARRAY_AGG(pi.id::text ORDER BY pi.id) FILTER (WHERE pi.id IS NOT NULL), ARRAY[]::text[]) as parameter_item_ids
    FROM departments d
    LEFT JOIN (
        -- Parameter items assigned to this specific department
        SELECT DISTINCT pid.department_id, pi.id
        FROM parameter_item_departments pid
        JOIN parameter_items pi ON pi.id = pid.parameter_item_id
        JOIN parameters p ON p.id = pi.parameter_id AND p.active = true
        WHERE pid.active = true
        UNION
        -- Cross-department items (available to all user departments)
        SELECT DISTINCT ud.department_id, cdi.id
        FROM user_departments ud
        CROSS JOIN cross_department_items cdi
    ) pi_dept ON pi_dept.department_id = d.id
    LEFT JOIN parameter_items pi ON pi.id = pi_dept.id
    WHERE d.id IN (SELECT department_id FROM user_departments)
    GROUP BY d.id
),
department_mapping_data AS (
    SELECT COALESCE(
        jsonb_object_agg(
            d.id::text,
            jsonb_build_object(
                'name', d.title,
                'description', COALESCE(d.description, ''),
                'parameter_ids', CASE WHEN dparami.parameter_ids IS NOT NULL AND array_length(dparami.parameter_ids, 1) > 0 THEN to_jsonb(dparami.parameter_ids) ELSE NULL END,
                'parameter_item_ids', CASE WHEN dparamitems.parameter_item_ids IS NOT NULL AND array_length(dparamitems.parameter_item_ids, 1) > 0 THEN to_jsonb(dparamitems.parameter_item_ids) ELSE NULL END
            )
        ) FILTER (WHERE d.id IS NOT NULL),
        '{}'::jsonb
    ) as mapping
    FROM departments d
    LEFT JOIN department_parameter_ids dparami ON dparami.department_id = d.id
    LEFT JOIN department_parameter_item_ids dparamitems ON dparamitems.department_id = d.id
    WHERE d.id IN (SELECT department_id FROM user_departments)
),
parameter_data AS (
    SELECT DISTINCT 
        p.id,
        p.name,
        COALESCE(p.description, '') as description,
        p.numerical,
        p.document_parameter,
        p.persona_parameter
    FROM parameters p
    JOIN parameter_items pi ON pi.parameter_id = p.id
    LEFT JOIN parameter_item_departments pid ON pid.parameter_item_id = pi.id AND pid.active = true
    WHERE p.active = true
    GROUP BY p.id, p.name, p.description, p.numerical, p.document_parameter, p.persona_parameter
    HAVING 
        COUNT(pid.parameter_item_id) FILTER (WHERE pid.department_id IN (SELECT department_id FROM user_departments)) > 0
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
                'document_parameter', p.document_parameter,
                'persona_parameter', p.persona_parameter
            )
        ),
        '{}'::jsonb
    ) as mapping
    FROM parameter_data p
),
document_valid_parameter_items AS (
    SELECT 
        dd.document_id,
        COALESCE(
            ARRAY_AGG(DISTINCT pi.id::text ORDER BY pi.id::text) FILTER (WHERE pi.id IS NOT NULL),
            ARRAY[]::text[]
        ) as valid_parameter_item_ids
    FROM document_data dd
    LEFT JOIN parameter_items pi ON pi.parameter_id IN (SELECT id FROM parameters WHERE active = true)
    LEFT JOIN parameter_item_departments pid ON pid.parameter_item_id = pi.id AND pid.active = true
    WHERE (
        -- If document has no departments, include only cross-department items
        (dd.department_ids IS NULL OR array_length(dd.department_ids, 1) = 0)
        AND NOT EXISTS (
            SELECT 1 FROM parameter_item_departments pid2 
            WHERE pid2.parameter_item_id = pi.id 
            AND pid2.active = true
        )
    ) OR (
        -- If document has departments, include items from those departments OR cross-department items
        dd.department_ids IS NOT NULL 
        AND array_length(dd.department_ids, 1) > 0
        AND (
            pid.department_id = ANY(SELECT unnest(dd.department_ids)::uuid)
            OR NOT EXISTS (
                SELECT 1 FROM parameter_item_departments pid2 
                WHERE pid2.parameter_item_id = pi.id 
                AND pid2.active = true
            )
        )
    )
    GROUP BY dd.document_id
)
SELECT 
    dd.*,
    SUBSTRING(dd.file_path FROM '\\.([^\\.]+)$') as extension,
    CASE 
        WHEN dd.active_scenario_count > 0 THEN false
        WHEN up.role IN ('admin', 'instructional', 'superadmin') THEN true
        ELSE false
    END as can_edit,
    CASE 
        WHEN dd.total_scenario_links > 0 THEN false
        WHEN up.role IN ('admin', 'instructional', 'superadmin') THEN true
        ELSE false
    END as can_delete,
    COALESCE(dvpi.valid_parameter_item_ids, ARRAY[]::text[]) as valid_parameter_item_ids,
    sm.mapping as scenario_mapping,
    pim.mapping as parameter_item_mapping,
    dm.mapping as department_mapping,
    pm.mapping as parameter_mapping
FROM document_data dd
CROSS JOIN user_profile up
CROSS JOIN scenario_mapping_data sm
CROSS JOIN parameter_item_mapping_data pim
CROSS JOIN department_mapping_data dm
CROSS JOIN parameter_mapping_data pm
LEFT JOIN document_valid_parameter_items dvpi ON dvpi.document_id = dd.document_id
ORDER BY dd.updated_at DESC

