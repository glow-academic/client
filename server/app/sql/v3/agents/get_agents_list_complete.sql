-- Get agents list with permissions
-- @params
--   profile_id: uuid
-- All parameters are cast exactly once in params CTE for reliable type introspection
WITH params AS (
    SELECT $1::uuid AS profile_id
),
user_departments AS (
    SELECT department_id
    FROM params x
    JOIN profile_departments ON profile_departments.profile_id = x.profile_id AND profile_departments.active = true
),
user_profile AS (
    SELECT 
        role,
        COALESCE(first_name || ' ' || last_name, 'System') as actor_name
    FROM params x
    JOIN profiles ON profiles.id = x.profile_id
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
    SELECT 
        d.id::text as department_id,
        d.title::text as department_name,
        COALESCE(d.description, '')::text as department_description
    FROM departments d
    WHERE d.id IN (SELECT department_id FROM all_department_ids)
)
SELECT 
    a.id::text as agent_id,
    a.name::text as name,
    a.description::text as description,
    COALESCE(mrl.reasoning_level::text, '') as reasoning,
    COALESCE(mtl.temperature, 0.0)::float as temperature,
    a.model_id::text as model_id,
    a.role::text as role,
    a.updated_at::timestamptz as updated_at,
    COALESCE(addd.department_ids, NULL)::text[] as department_ids,
    CASE WHEN up.role IN ('admin', 'superadmin') THEN true::boolean ELSE false::boolean END as can_edit,
    true::boolean as can_duplicate,
    CASE 
        WHEN COALESCE(adl.total_links, 0) > 0 THEN false::boolean
        WHEN up.role = 'superadmin' THEN true::boolean
        ELSE false::boolean
    END as can_delete,
    m.name::text as model_name,
    COALESCE(m.description, '')::text as model_description,
    dmd.department_id::text as "department_mapping__id",
    dmd.department_name::text as "department_mapping__name",
    dmd.department_description::text as "department_mapping__description",
    up.actor_name::text as actor_name
FROM agents a
CROSS JOIN user_profile up
LEFT JOIN agent_department_links adl ON adl.agent_id = a.id
LEFT JOIN agent_departments ad ON ad.agent_id = a.id AND ad.active = true
LEFT JOIN agent_departments_data addd ON addd.agent_id = a.id
-- Join temperature from junction table
LEFT JOIN agent_temperature_levels atl ON atl.agent_id = a.id AND atl.active = true
LEFT JOIN model_temperature_levels mtl ON mtl.id = atl.model_temperature_level_id AND mtl.active = true
-- Join reasoning from junction table
LEFT JOIN agent_reasoning_levels arl ON arl.agent_id = a.id AND arl.active = true
LEFT JOIN model_reasoning_levels mrl ON mrl.id = arl.model_reasoning_level_id AND mrl.active = true
LEFT JOIN models m ON m.id = a.model_id
CROSS JOIN department_mapping_data dmd
GROUP BY a.id, a.name, a.description, mrl.reasoning_level, COALESCE(mtl.temperature, 0.0), a.model_id, a.role, a.updated_at,
         addd.department_ids, adl.total_links, up.role, up.actor_name, m.name, m.description, dmd.department_id, dmd.department_name, dmd.department_description
HAVING 
    -- Include if has matching department link OR has no department links at all (cross-dept)
    COUNT(ad.agent_id) FILTER (WHERE ad.department_id IN (SELECT department_id FROM user_departments)) > 0
    OR NOT EXISTS (SELECT 1 FROM agent_departments ad2 WHERE ad2.agent_id = a.id AND ad2.active = true)
ORDER BY a.name

