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
filtered_agents AS (
    SELECT 
        a.id,
        a.name,
        a.description,
        a.model_id,
        a.role,
        a.updated_at
    FROM agents a
    LEFT JOIN agent_departments ad ON ad.agent_id = a.id AND ad.active = true
    GROUP BY a.id, a.name, a.description, a.model_id, a.role, a.updated_at
    HAVING 
        -- Include if has matching department link OR has no department links at all (cross-dept)
        COUNT(ad.agent_id) FILTER (WHERE ad.department_id IN (SELECT department_id FROM user_departments)) > 0
        OR NOT EXISTS (SELECT 1 FROM agent_departments ad2 WHERE ad2.agent_id = a.id AND ad2.active = true)
),
all_department_ids AS (
    SELECT DISTINCT unnest(department_ids)::uuid as department_id
    FROM agent_departments_data
    WHERE department_ids IS NOT NULL
),
department_mapping_data AS (
    -- Only include departments that are actually assigned to at least one agent
    -- Use UNION with dummy row to ensure at least one row exists for CROSS JOIN
    SELECT 
        d.id::text as department_id,
        d.title::text as department_name,
        COALESCE(d.description, '')::text as department_description
    FROM departments d
    WHERE d.id IN (SELECT department_id FROM all_department_ids)
    UNION ALL
    -- Dummy row to ensure CROSS JOIN always produces at least one row
    SELECT NULL::text, NULL::text, NULL::text
    WHERE NOT EXISTS (SELECT 1 FROM departments d WHERE d.id IN (SELECT department_id FROM all_department_ids))
    LIMIT 1
),
all_model_ids AS (
    SELECT DISTINCT model_id
    FROM filtered_agents
    WHERE model_id IS NOT NULL
),
model_mapping_data AS (
    SELECT 
        m.id::text as model_id,
        m.name::text as model_name,
        COALESCE(m.description, '')::text as model_description
    FROM models m
    WHERE m.id IN (SELECT model_id FROM all_model_ids)
    UNION ALL
    -- Dummy row to ensure CROSS JOIN always produces at least one row
    SELECT NULL::text, NULL::text, NULL::text
    WHERE NOT EXISTS (SELECT 1 FROM models m WHERE m.id IN (SELECT model_id FROM all_model_ids))
    LIMIT 1
)
SELECT 
    -- Agents columns with __ prefix
    fa.id::text as "agents__agent_id",
    fa.name::text as "agents__name",
    fa.description::text as "agents__description",
    COALESCE(mrl.reasoning_level::text, '')::text as "agents__reasoning",
    COALESCE(mtl.temperature, 0.0)::float as "agents__temperature",
    fa.model_id::text as "agents__model_id",
    fa.role::text as "agents__role",
    fa.updated_at::text as "agents__updated_at",
    COALESCE(addd.department_ids, ARRAY[]::text[])::text[] as "agents__department_ids",
    CASE WHEN up.role IN ('admin', 'superadmin') THEN true::boolean ELSE false::boolean END as "agents__can_edit",
    true::boolean as "agents__can_duplicate",
    CASE 
        WHEN COALESCE(adl.total_links, 0) > 0 THEN false::boolean
        WHEN up.role = 'superadmin' THEN true::boolean
        ELSE false::boolean
    END as "agents__can_delete",
    m.name::text as "agents__model_name",
    COALESCE(m.description, '')::text as "agents__model_description",
    up.actor_name::text as "agents__actor_name",
    -- Model mapping columns with __ prefix
    mmd.model_id::text as "model_mapping__id",
    mmd.model_name::text as "model_mapping__name",
    mmd.model_description::text as "model_mapping__description",
    -- Department mapping columns with __ prefix
    dmd.department_id::text as "department_mapping__id",
    dmd.department_name::text as "department_mapping__name",
    dmd.department_description::text as "department_mapping__description",
    -- Top-level actor_name (same for all rows)
    up.actor_name::text as actor_name
FROM filtered_agents fa
CROSS JOIN user_profile up
CROSS JOIN model_mapping_data mmd
CROSS JOIN department_mapping_data dmd
LEFT JOIN agent_department_links adl ON adl.agent_id = fa.id
LEFT JOIN agent_departments_data addd ON addd.agent_id = fa.id
-- Join temperature from junction table
LEFT JOIN agent_temperature_levels atl ON atl.agent_id = fa.id AND atl.active = true
LEFT JOIN model_temperature_levels mtl ON mtl.id = atl.model_temperature_level_id AND mtl.active = true
-- Join reasoning from junction table
LEFT JOIN agent_reasoning_levels arl ON arl.agent_id = fa.id AND arl.active = true
LEFT JOIN model_reasoning_levels mrl ON mrl.id = arl.model_reasoning_level_id AND mrl.active = true
LEFT JOIN models m ON m.id = fa.model_id
ORDER BY fa.name, mmd.model_name, dmd.department_name

