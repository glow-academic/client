-- Get agents list with permissions
-- Converted to function with composite types
-- Uses safe drop/recreate pattern: drop function first, then types (no CASCADE), then recreate

BEGIN;

-- 1) Drop function first (breaks dependency on types)
-- Drop all versions of the function using DO block to handle signature variations
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'api_list_agents_v3'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_list_agents_v3(%s)', r.sig);
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
        WHERE typname LIKE 'q_list_agents_v3_%'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I', r.typname);
    END LOOP;
END $$;

-- 3) Recreate types
CREATE TYPE types.q_list_agents_v3_agent AS (
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
CREATE OR REPLACE FUNCTION api_list_agents_v3(profile_id uuid)
RETURNS TABLE (
    actor_name text,
    agents types.q_list_agents_v3_agent[]
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
)
SELECT 
    up.actor_name::text as actor_name,
    COALESCE(
        ARRAY_AGG(
            (fa.id, fa.name, fa.description, 
             COALESCE(mrl.reasoning_level::text, ''),
             COALESCE(mtl.temperature, 0.0),
             fa.model_id, fa.role, fa.updated_at,
             COALESCE(addd.department_ids, ARRAY[]::text[]),
             CASE WHEN up.role IN (profile_role.admin, profile_role.superadmin) THEN true ELSE false END,
             true,
             CASE 
                 WHEN COALESCE(adl.total_links, 0) > 0 THEN false
                 WHEN up.role = profile_role.superadmin THEN true
                 ELSE false
             END,
             m.name,
             COALESCE(m.description, ''),
             up.actor_name
            )::types.q_list_agents_v3_agent
            ORDER BY fa.name
        ),
        '{}'::types.q_list_agents_v3_agent[]
    ) as agents
FROM filtered_agents fa
CROSS JOIN user_profile up
LEFT JOIN agent_department_links adl ON adl.agent_id = fa.id
LEFT JOIN agent_departments_data addd ON addd.agent_id = fa.id
-- Join temperature from junction table
LEFT JOIN agent_temperature_levels atl ON atl.agent_id = fa.id AND atl.active = true
LEFT JOIN model_temperature_levels mtl ON mtl.id = atl.model_temperature_level_id AND mtl.active = true
-- Join reasoning from junction table
LEFT JOIN agent_reasoning_levels arl ON arl.agent_id = fa.id AND arl.active = true
LEFT JOIN model_reasoning_levels mrl ON mrl.id = arl.model_reasoning_level_id AND mrl.active = true
LEFT JOIN models m ON m.id = fa.model_id
GROUP BY up.actor_name, up.role
$$;

COMMIT;
