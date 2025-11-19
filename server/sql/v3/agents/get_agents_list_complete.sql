WITH user_departments AS (
    SELECT department_id
    FROM profile_departments
    WHERE profile_id = $1 AND active = true
),
user_profile AS (
    SELECT role FROM profiles WHERE id = $1::uuid
),
agent_department_links AS (
    SELECT 
        agent_id,
        COUNT(*) as total_links
    FROM agent_departments
    WHERE active = true
    GROUP BY agent_id
),
agent_departments_data AS (
    SELECT 
        ad.agent_id,
        ARRAY_AGG(ad.department_id::text ORDER BY ad.created_at) as department_ids
    FROM agent_departments ad
    WHERE ad.active = true
    GROUP BY ad.agent_id
),
all_department_ids AS (
    SELECT DISTINCT unnest(department_ids)::uuid as department_id
    FROM agent_departments_data
    WHERE department_ids IS NOT NULL
    UNION
    SELECT department_id FROM user_departments
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
)
SELECT 
    a.id::text as agent_id,
    a.name,
    a.description,
    a.reasoning,
    a.temperature,
    a.model_id::text,
    a.role,
    a.updated_at,
    COALESCE(addd.department_ids, NULL) as department_ids,
    CASE WHEN up.role IN ('admin', 'superadmin') THEN true ELSE false END as can_edit,
    true as can_duplicate,
    CASE 
        WHEN COALESCE(adl.total_links, 0) > 0 THEN false
        WHEN up.role = 'superadmin' THEN true
        ELSE false
    END as can_delete,
    m.name as model_name,
    COALESCE(m.description, '') as model_description,
    dmd.mapping as department_mapping
FROM agents a
CROSS JOIN user_profile up
LEFT JOIN agent_department_links adl ON adl.agent_id = a.id
LEFT JOIN agent_departments ad ON ad.agent_id = a.id AND ad.active = true
LEFT JOIN agent_departments_data addd ON addd.agent_id = a.id
LEFT JOIN models m ON m.id = a.model_id
CROSS JOIN department_mapping_data dmd
GROUP BY a.id, a.name, a.description, a.reasoning, a.temperature, a.model_id, a.role, a.updated_at,
         addd.department_ids, adl.total_links, up.role, m.name, m.description, dmd.mapping
HAVING 
    -- Include if has matching department link OR has no department links at all (cross-dept)
    COUNT(ad.agent_id) FILTER (WHERE ad.department_id IN (SELECT department_id FROM user_departments)) > 0
    OR NOT EXISTS (SELECT 1 FROM agent_departments ad2 WHERE ad2.agent_id = a.id AND ad2.active = true)
ORDER BY a.name

