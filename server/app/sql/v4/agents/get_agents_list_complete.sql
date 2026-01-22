-- Get agents list with permissions
-- Converted to function with composite types
-- Uses safe drop/recreate pattern: drop function first, then types (no CASCADE), then recreate
-- 1) Drop function first (breaks dependency on types)
-- Drop all versions of the function using DO block to handle signature variations
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'api_list_agents_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_list_agents_v4(%s)', r.sig);
    END LOOP;
END $$;

-- 2) Drop types WITHOUT CASCADE
-- Drop all types matching prefix pattern to handle type additions/removals
-- If any other object depends on them, this will ERROR and stop the migration (good)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT typname 
        FROM pg_type 
        WHERE typname LIKE 'q_list_agents_v4_%'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I', r.typname);
    END LOOP;
END $$;

-- 3) Recreate types
CREATE TYPE types.q_list_agents_v4_agent AS (
    agent_id uuid,
    name text,
    description text,
    reasoning text,
    temperature float,
    model_id uuid,
    role text,
    updated_at timestamptz,
    department_ids text[],
    can_edit boolean,
    can_duplicate boolean,
    can_delete boolean,
    model_name text,
    model_description text,
    actor_name text
);

-- 4) Recreate function
CREATE OR REPLACE FUNCTION api_list_agents_v4(profile_id uuid)
RETURNS TABLE (
    actor_name text,
    agents types.q_list_agents_v4_agent[]
)
LANGUAGE sql
STABLE
AS $$
WITH params AS (
    SELECT profile_id AS profile_id
),
user_departments AS (
    SELECT department_id
    FROM params x
    JOIN profile_departments ON profile_departments.profile_id = x.profile_id AND profile_departments.active = true
),
user_profile AS (
    SELECT 
        (SELECT r.role FROM profile_roles pr_j 
         JOIN roles_resource r ON pr_j.role_id = r.id 
         WHERE pr_j.profile_id = profile_artifact.id 
         LIMIT 1) as role,
        COALESCE((SELECT n.name FROM profile_names pn JOIN names_resource n ON pn.name_id = n.id WHERE pn.profile_id = profile_artifact.id LIMIT 1), 'System') as actor_name
    FROM params x
    JOIN profile_artifact ON profile_artifact.id = x.profile_id
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
        (SELECT n.name FROM agent_names an JOIN names_resource n ON an.name_id = n.id WHERE an.agent_id = a.id LIMIT 1) as name,
        (SELECT (SELECT d.description FROM document_descriptions dd JOIN descriptions_resource d ON dd.description_id = d.id WHERE dd.document_id = d.id LIMIT 1) FROM agent_descriptions ad JOIN descriptions_resource d ON ad.description_id = d.id WHERE NULL::uuid = a.id LIMIT 1) as description,
        (SELECT m.id FROM agent_models am JOIN models_resource m ON am.model_id = m.id WHERE am.agent_id = a.id LIMIT 1) as model_id,
        COALESCE(NULL::artifacts::text, '') as role,  -- Derive from agent's tools via artifact_resources_relation
        a.updated_at
    FROM agent_artifact a
    LEFT JOIN LATERAL (
        SELECT DISTINCT ar.artifact::text
        FROM agent_tools at
        JOIN resource_tools_relation rt ON rt.tool_id = at.tool_id
        JOIN artifact_resources_relation ar ON ar.resource = rt.resource
        WHERE at.agent_id = a.id AND at.active = TRUE
        LIMIT 1
    ) da ON TRUE
    LEFT JOIN agent_departments ad ON ad.agent_id = a.id AND ad.active = true
    GROUP BY a.id, NULL::artifacts, a.updated_at
    HAVING 
        -- Include if has matching department link OR has no department links at all (cross-dept)
        COUNT(NULL::uuid) FILTER (WHERE ad.department_id IN (SELECT department_id FROM user_departments)) > 0
        OR NOT EXISTS (SELECT 1 FROM agent_departments ad2 WHERE ad2.agent_id = a.id AND ad2.active = true)
)
SELECT 
    up.actor_name::text as actor_name,
    COALESCE(
        ARRAY_AGG(
            (fa.id, fa.name, fa.description, 
             COALESCE(rl.reasoning_level::text, ''),
             COALESCE(tl.temperature, 0.0),
             fa.model_id, fa.role, fa.updated_at,
             COALESCE(addd.department_ids, ARRAY[]::text[]),
             CASE WHEN up.role IN ('admin'::profile_role, 'superadmin'::profile_role) THEN true ELSE false END,
             true,
             CASE 
                 WHEN COALESCE(adl.total_links, 0) > 0 THEN false
                 WHEN up.role = 'superadmin'::profile_role THEN true
                 ELSE false
             END,
             (SELECT n.name FROM model_names mn JOIN names_resource n ON mn.name_id = n.id WHERE mn.model_id = m.id LIMIT 1),
             COALESCE((SELECT (SELECT d.description FROM document_descriptions dd JOIN descriptions_resource d ON dd.description_id = d.id WHERE dd.document_id = d.id LIMIT 1) FROM model_descriptions md JOIN descriptions_resource d ON md.description_id = d.id WHERE md.model_id = m.id LIMIT 1), ''),
             up.actor_name
            )::types.q_list_agents_v4_agent
            ORDER BY fa.name
        ),
        '{}'::types.q_list_agents_v4_agent[]
    ) as agents
FROM filtered_agents fa
CROSS JOIN user_profile up
LEFT JOIN agent_department_links adl ON adl.agent_id = fa.id
LEFT JOIN agent_departments_data addd ON addd.agent_id = fa.id
-- Join temperature from junction table
LEFT JOIN agent_temperature_levels atl ON atl.agent_id = fa.id AND atl.active = true
LEFT JOIN model_temperature_levels mtl ON mtl.temperature_level_id = atl.temperature_level_id AND mtl.model_id = fa.model_id
LEFT JOIN temperature_levels_resource tl ON tl.id = mtl.temperature_level_id AND tl.active = true
-- Join reasoning from junction table
LEFT JOIN agent_reasoning_levels arl ON arl.agent_id = fa.id AND arl.active = true
LEFT JOIN model_reasoning_levels mrl ON mrl.reasoning_level_id = arl.reasoning_level_id AND mrl.model_id = fa.model_id
LEFT JOIN reasoning_levels_resource rl ON rl.id = mrl.reasoning_level_id AND rl.active = true
LEFT JOIN models_resource m ON m.id = fa.model_id
GROUP BY up.actor_name, up.role
$$;