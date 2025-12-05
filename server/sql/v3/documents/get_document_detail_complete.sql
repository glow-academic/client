WITH document_data AS (
    SELECT 
        d.id::text as document_id,
        d.name,
        d.active,
        d.template,
        d.template_args,
        d.updated_at,
        d.classify_agent_id::text,
        d.document_agent_id::text,
        (SELECT ARRAY_AGG(dd.department_id::text) FROM document_departments dd WHERE dd.document_id = d.id AND dd.active = true) as department_ids,
        (SELECT ARRAY_AGG(df.field_id::text) FROM document_fields df WHERE df.document_id = d.id AND df.active = true) as parameter_item_ids,
        (SELECT du.upload_id::text FROM document_uploads du WHERE du.document_id = d.id AND du.active = true ORDER BY du.created_at DESC LIMIT 1) as upload_id,
        (SELECT du.upload_id::text FROM document_uploads du WHERE du.document_id = d.id AND du.active = true ORDER BY du.created_at DESC LIMIT 1) as template_upload_id,
        (SELECT u.file_path FROM document_uploads du 
         JOIN uploads u ON u.id = du.upload_id 
         WHERE du.document_id = d.id AND du.active = true ORDER BY du.created_at DESC LIMIT 1) as file_path,
        (SELECT ARRAY_AGG(DISTINCT st.parent_id::text) FROM scenario_documents sd
         JOIN scenario_tree st ON st.child_id = sd.scenario_id AND st.parent_id = st.child_id
         WHERE sd.document_id = d.id AND sd.active = true) as scenario_ids,
        (SELECT COUNT(*) FROM scenario_documents sd WHERE sd.document_id = d.id AND sd.active = true) as active_scenario_count,
        (SELECT COUNT(*) FROM scenario_documents sd WHERE sd.document_id = d.id) as total_scenario_links
    FROM documents d
    WHERE d.id = $1
),
user_profile AS (
    SELECT role FROM profiles WHERE id = $2
),
user_departments AS (
    SELECT DISTINCT d.id, d.title as name, d.description
    FROM departments d
    JOIN profile_departments pd ON d.id = pd.department_id
    WHERE pd.profile_id = $2 AND d.active = true
),
department_parameter_ids AS (
    SELECT 
        ud.id as department_id,
        COALESCE(ARRAY_AGG(DISTINCT p.id::text) FILTER (WHERE p.id IS NOT NULL), ARRAY[]::text[]) as parameter_ids
    FROM user_departments ud
    LEFT JOIN parameters p ON p.active = true
    LEFT JOIN field_parameters fp ON fp.parameter_id = p.id AND fp.active = true
    LEFT JOIN field_departments fd ON fd.field_id = fp.field_id AND fd.active = true
    WHERE (fd.department_id = ud.id OR NOT EXISTS (SELECT 1 FROM field_departments fd2 
                                                     JOIN field_parameters fp2 ON fp2.field_id = fd2.field_id 
                                                     WHERE fp2.parameter_id = p.id AND fp2.active = true AND fd2.active = true))
    GROUP BY ud.id
),
valid_depts AS (
    SELECT 
        COALESCE(
            jsonb_object_agg(
                ud.id::text,
                jsonb_build_object(
                    'name', ud.name,
                    'description', COALESCE(ud.description, ''),
                    'parameter_ids', CASE WHEN dparami.parameter_ids IS NOT NULL AND array_length(dparami.parameter_ids, 1) > 0 THEN to_jsonb(dparami.parameter_ids) ELSE NULL END
                )
            ),
            '{}'::jsonb
        ) as dept_mapping,
        array_agg(ud.id::text ORDER BY ud.name) as dept_ids
    FROM user_departments ud
    LEFT JOIN department_parameter_ids dparami ON dparami.department_id = ud.id
),
valid_param_items AS (
    SELECT 
        COALESCE(
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
        ) as param_item_mapping,
        array_agg(f.id::text ORDER BY f.name) as param_item_ids
    FROM fields f
    JOIN field_parameters fp ON fp.field_id = f.id AND fp.active = true
    JOIN parameters p ON p.id = fp.parameter_id
    CROSS JOIN document_data dd
    LEFT JOIN field_departments fd ON fd.field_id = f.id AND fd.active = true
    WHERE p.active = true
      AND (
          (dd.department_ids IS NULL OR array_length(dd.department_ids, 1) = 0)
          AND NOT EXISTS (SELECT 1 FROM field_departments fd2 WHERE fd2.field_id = f.id AND fd2.active = true)
      )
      OR (
          dd.department_ids IS NOT NULL 
          AND array_length(dd.department_ids, 1) > 0
          AND fd.department_id = ANY(SELECT unnest(dd.department_ids)::uuid)
      )
),
user_departments_for_agents AS (
    SELECT department_id
    FROM profile_departments
    WHERE profile_id = $2 AND active = true
),
valid_agents AS (
    -- Get agents with roles 'classify' or 'document'
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
        array_agg(a.id::text ORDER BY a.name) as agent_ids
    FROM agents a
    LEFT JOIN agent_departments ad ON ad.agent_id = a.id AND ad.active = true
    WHERE a.active = true 
    AND a.role IN ('classify', 'document')
    GROUP BY a.id
    HAVING 
        COUNT(ad.agent_id) FILTER (WHERE ad.department_id IN (SELECT department_id FROM user_departments_for_agents)) > 0
        OR NOT EXISTS (SELECT 1 FROM agent_departments ad2 WHERE ad2.agent_id = a.id AND ad2.active = true)
)
SELECT 
    doc.*,
    vd.dept_mapping as department_mapping,
    vd.dept_ids as valid_department_ids,
    vpi.param_item_mapping as parameter_item_mapping,
    vpi.param_item_ids as valid_parameter_item_ids,
    COALESCE(va.agent_mapping, '{}'::jsonb) as agent_mapping,
    COALESCE(va.agent_ids, ARRAY[]::text[]) as valid_agent_ids,
    CASE 
        WHEN doc.file_path IS NOT NULL THEN SUBSTRING(doc.file_path FROM '\\.([^\\.]+)$')
        ELSE NULL
    END as extension,
    CASE 
        WHEN doc.active_scenario_count > 0 THEN false
        WHEN up.role IN ('admin', 'instructional', 'superadmin') THEN true
        ELSE false
    END as can_edit,
    CASE 
        WHEN doc.total_scenario_links > 0 THEN false
        WHEN up.role IN ('admin', 'instructional', 'superadmin') THEN true
        ELSE false
    END as can_delete
FROM document_data doc
CROSS JOIN user_profile up
CROSS JOIN valid_depts vd
CROSS JOIN valid_param_items vpi
CROSS JOIN valid_agents va

