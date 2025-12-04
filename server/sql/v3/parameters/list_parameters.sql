WITH resolve_profile_id AS (
    -- Resolve "guest-profile-id" to actual default guest profile ID
    SELECT 
        CASE 
            WHEN $1::text = 'guest-profile-id' THEN
                (SELECT id::uuid FROM profiles WHERE role = 'guest' AND first_name = 'Default' ORDER BY created_at DESC LIMIT 1)
            ELSE $1::uuid
        END as resolved_profile_id
),
user_departments AS (
    SELECT rpi.resolved_profile_id, pd.department_id
    FROM resolve_profile_id rpi
    JOIN profile_departments pd ON pd.profile_id = rpi.resolved_profile_id
    WHERE pd.active = true
),
parameter_active_scenario_links AS (
    SELECT 
        pi.parameter_id,
        COUNT(DISTINCT spi.scenario_id) as active_scenario_count
    FROM parameter_items pi
    JOIN scenario_parameter_items spi ON spi.parameter_item_id = pi.id
    WHERE spi.active = true
    GROUP BY pi.parameter_id
),
parameter_all_scenario_links AS (
    SELECT 
        pi.parameter_id,
        COUNT(DISTINCT spi.scenario_id) as total_scenario_links
    FROM parameter_items pi
    JOIN scenario_parameter_items spi ON spi.parameter_item_id = pi.id
    GROUP BY pi.parameter_id
),
parameter_scenarios AS (
    SELECT 
        pi.parameter_id,
        ARRAY_AGG(DISTINCT st.parent_id::text ORDER BY st.parent_id::text) as scenario_ids,
        COUNT(DISTINCT st.parent_id) as num_scenarios
    FROM parameter_items pi
    JOIN scenario_parameter_items spi ON spi.parameter_item_id = pi.id
    JOIN scenario_tree st ON st.child_id = spi.scenario_id AND st.parent_id = st.child_id
    WHERE spi.active = true
    GROUP BY pi.parameter_id
),
parameter_item_counts AS (
    SELECT 
        parameter_id,
        COUNT(*) as num_items
    FROM parameter_items
    GROUP BY parameter_id
),
parameter_sample_items AS (
    SELECT 
        pi.parameter_id,
        jsonb_agg(
            jsonb_build_object(
                'parameter_item_id', pi.id::text,
                'name', pi.name,
                'description', pi.description,
                'value', pi.value
            ) ORDER BY pi.name
        ) as sample_items
    FROM (
        SELECT id, parameter_id, name, description, value,
               ROW_NUMBER() OVER (PARTITION BY parameter_id ORDER BY name) as rn
        FROM parameter_items
    ) pi
    WHERE pi.rn <= 3
    GROUP BY pi.parameter_id
),
parameter_item_departments_data AS (
    SELECT 
        pi.parameter_id,
        ARRAY_AGG(pid.department_id::text ORDER BY pid.created_at) as department_ids
    FROM parameter_items pi
    JOIN parameter_item_departments pid ON pid.parameter_item_id = pi.id
    WHERE pid.active = true
    GROUP BY pi.parameter_id
),
parameter_item_departments_for_filter AS (
    SELECT DISTINCT
        pi.parameter_id,
        pid.department_id
    FROM parameter_items pi
    JOIN parameter_item_departments pid ON pid.parameter_item_id = pi.id
    WHERE pid.active = true
),
parameter_documents AS (
    SELECT 
        pi.parameter_id,
        ARRAY_AGG(DISTINCT dpi.document_id::text ORDER BY dpi.document_id::text) as document_ids
    FROM parameter_items pi
    JOIN document_parameter_items dpi ON dpi.parameter_item_id = pi.id
    WHERE dpi.active = true
    GROUP BY pi.parameter_id
),
user_profile AS (
    SELECT p.role
    FROM resolve_profile_id rpi
    JOIN profiles p ON p.id = rpi.resolved_profile_id
),
all_department_ids AS (
    SELECT DISTINCT unnest(department_ids)::uuid as department_id
    FROM parameter_item_departments_data
    WHERE department_ids IS NOT NULL
    UNION
    SELECT ud.department_id FROM user_departments ud
),
all_scenario_ids AS (
    SELECT DISTINCT unnest(scenario_ids)::uuid as scenario_id
    FROM parameter_scenarios
    WHERE scenario_ids IS NOT NULL
),
all_document_ids AS (
    SELECT DISTINCT unnest(document_ids)::uuid as document_id
    FROM parameter_documents
    WHERE document_ids IS NOT NULL
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
    WHERE d.id IN (SELECT department_id FROM all_department_ids)
),
document_mapping_data AS (
    SELECT COALESCE(
        jsonb_object_agg(
            doc.id::text,
            jsonb_build_object(
                'name', doc.name,
                'description', ''
            )
        ) FILTER (WHERE doc.id IS NOT NULL),
        '{}'::jsonb
    ) as mapping
    FROM documents doc
    WHERE doc.id IN (SELECT document_id FROM all_document_ids)
)
SELECT 
    p.id as parameter_id,
    p.name,
    p.description,
    p.numerical,
    p.active,
    p.updated_at,
    COALESCE(pidd.department_ids, NULL) as department_ids,
    COALESCE(pic.num_items, 0) as num_items,
    COALESCE(ps.scenario_ids, ARRAY[]::text[]) as scenario_ids,
    COALESCE(pd.document_ids, ARRAY[]::text[]) as document_ids,
    COALESCE(pasl.active_scenario_count, 0) as active_scenario_count,
    COALESCE(pasl_all.total_scenario_links, 0) as total_scenario_links,
    COALESCE(psi.sample_items, '[]'::jsonb) as sample_items_json,
    sm.mapping as scenario_mapping,
    dmd.mapping as department_mapping,
    docmd.mapping as document_mapping,
    CASE 
        WHEN COALESCE(pasl.active_scenario_count, 0) > 0 THEN false
        WHEN up.role IN ('admin', 'superadmin') THEN true
        ELSE false
    END as can_edit,
    CASE 
        WHEN COALESCE(pasl_all.total_scenario_links, 0) > 0 THEN false
        WHEN up.role IN ('admin', 'superadmin') THEN true
        ELSE false
    END as can_delete,
    CASE 
        WHEN up.role IN ('admin', 'superadmin') THEN true
        ELSE false
    END as can_duplicate
FROM parameters p
LEFT JOIN parameter_item_departments_for_filter pidf ON pidf.parameter_id = p.id
LEFT JOIN parameter_item_departments_data pidd ON pidd.parameter_id = p.id
LEFT JOIN parameter_item_counts pic ON pic.parameter_id = p.id
LEFT JOIN parameter_scenarios ps ON ps.parameter_id = p.id
LEFT JOIN parameter_documents pd ON pd.parameter_id = p.id
LEFT JOIN parameter_active_scenario_links pasl ON pasl.parameter_id = p.id
LEFT JOIN parameter_all_scenario_links pasl_all ON pasl_all.parameter_id = p.id
LEFT JOIN parameter_sample_items psi ON psi.parameter_id = p.id
CROSS JOIN user_profile up
CROSS JOIN scenario_mapping_data sm
CROSS JOIN department_mapping_data dmd
CROSS JOIN document_mapping_data docmd
GROUP BY p.id, p.name, p.description, p.numerical, p.active, p.updated_at, pidd.department_ids, pic.num_items, 
         ps.scenario_ids, pd.document_ids, pasl.active_scenario_count, pasl_all.total_scenario_links, psi.sample_items, up.role, sm.mapping, dmd.mapping, docmd.mapping
HAVING 
    -- Include if has matching department link via parameter_items OR has no department links at all (cross-dept)
    COUNT(pidf.parameter_id) FILTER (WHERE pidf.department_id IN (SELECT ud.department_id FROM user_departments ud)) > 0
    OR NOT EXISTS (SELECT 1 FROM parameter_item_departments pid2 
                  JOIN parameter_items pi2 ON pi2.id = pid2.parameter_item_id 
                  WHERE pi2.parameter_id = p.id AND pid2.active = true)
ORDER BY p.updated_at DESC NULLS LAST

