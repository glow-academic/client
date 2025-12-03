WITH document_data AS (
    SELECT 
        d.name,
        d.active,
        d.upload_id::text,
        d.classify_agent_id::text,
        d.document_agent_id::text,
        (SELECT ARRAY_AGG(dd.department_id::text) FROM document_departments dd WHERE dd.document_id = d.id AND dd.active = true) as department_ids,
        (SELECT ARRAY_AGG(dpi.parameter_item_id::text) FROM document_parameter_items dpi WHERE dpi.document_id = d.id AND dpi.active = true) as parameter_item_ids
    FROM documents d
    WHERE d.id = $1
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
    LEFT JOIN parameter_items pi ON pi.parameter_id = p.id
    LEFT JOIN parameter_item_departments pid ON pid.parameter_item_id = pi.id AND pid.active = true
    WHERE (pid.department_id = ud.id OR NOT EXISTS (SELECT 1 FROM parameter_item_departments pid2 
                                                     JOIN parameter_items pi2 ON pi2.id = pid2.parameter_item_id 
                                                     WHERE pi2.parameter_id = p.id AND pid2.active = true))
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
                pi.id::text,
                jsonb_build_object(
                    'name', pi.name,
                    'description', COALESCE(pi.description, ''),
                    'parameter_id', pi.parameter_id::text,
                    'parameter_name', p.name
                )
            ),
            '{}'::jsonb
        ) as param_item_mapping,
        array_agg(pi.id::text ORDER BY pi.name) as param_item_ids
    FROM parameter_items pi
    JOIN parameters p ON p.id = pi.parameter_id
    CROSS JOIN document_data dd
    LEFT JOIN parameter_item_departments pid ON pid.parameter_item_id = pi.id AND pid.active = true
    WHERE p.active = true
      AND (
          (dd.department_ids IS NULL OR array_length(dd.department_ids, 1) = 0)
          AND NOT EXISTS (SELECT 1 FROM parameter_item_departments pid2 WHERE pid2.parameter_item_id = pi.id AND pid2.active = true)
      )
      OR (
          dd.department_ids IS NOT NULL 
          AND array_length(dd.department_ids, 1) > 0
          AND pid.department_id = ANY(SELECT unnest(dd.department_ids)::uuid)
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
    COALESCE(va.agent_ids, ARRAY[]::text[]) as valid_agent_ids
FROM document_data doc
CROSS JOIN valid_depts vd
CROSS JOIN valid_param_items vpi
CROSS JOIN valid_agents va

