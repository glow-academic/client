-- Get agents list with resource-first pattern
-- Resource-first: only touches agent_artifact + agent's own junctions + resource tables
-- No cross-entity artifact tables (model_artifact, etc.)
-- Permissions computed in Python, model names hydrated from cached get_models_internal()
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
    department_link_count bigint
);

CREATE TYPE types.q_list_agents_v4_option_id AS (
    id uuid,
    count bigint
);

-- 4) Recreate function
CREATE OR REPLACE FUNCTION api_list_agents_v4(
    profile_id uuid,
    search text DEFAULT NULL,
    filter_department_ids uuid[] DEFAULT NULL,
    department_search text DEFAULT NULL,
    page_size int DEFAULT 12,
    page_offset int DEFAULT 0
)
RETURNS TABLE (
    agents types.q_list_agents_v4_agent[],
    department_option_ids types.q_list_agents_v4_option_id[],
    model_option_ids types.q_list_agents_v4_option_id[],
    total_count bigint
)
LANGUAGE sql
STABLE
AS $$
-- User context (actor_name, user_role) comes from get_profile_context_internal() in Python
WITH params AS (
    SELECT profile_id AS profile_id
),
user_departments AS (
    SELECT department_id
    FROM params x
    JOIN profile_departments_junction ON profile_departments_junction.profile_id = x.profile_id AND profile_departments_junction.active = true
),
agent_departments_data AS (
    SELECT
        ad.agent_id,
        ARRAY_AGG(ad.department_id::text ORDER BY ad.created_at) as department_ids,
        COUNT(*)::bigint as department_link_count
    FROM agent_departments_junction ad
    WHERE ad.active = true
    GROUP BY ad.agent_id
),
agent_data AS (
    SELECT
        a.id as agent_id,
        (SELECT n.name FROM agent_names_junction an JOIN names_resource n ON an.name_id = n.id WHERE an.agent_id = a.id LIMIT 1) as agent_name,
        (SELECT d.description FROM agent_descriptions_junction ad JOIN descriptions_resource d ON ad.description_id = d.id WHERE ad.agent_id = a.id LIMIT 1) as description,
        (SELECT m.id FROM agent_models_junction am JOIN models_resource m ON am.model_id = m.id WHERE am.agent_id = a.id LIMIT 1) as model_id,
        ''::text as role,
        a.updated_at,
        COALESCE(add_data.department_ids, NULL) as department_ids,
        COALESCE(add_data.department_link_count, 0) as department_link_count,
        -- Temperature from junction
        (SELECT tl.temperature FROM agent_temperature_levels_junction atl
         JOIN temperature_levels_resource tl ON tl.id = atl.temperature_level_id AND tl.active = true
         WHERE atl.agent_id = a.id AND atl.active = true LIMIT 1) as temperature,
        -- Reasoning from junction
        (SELECT rl.reasoning_level::text FROM agent_reasoning_levels_junction arl
         JOIN reasoning_levels_resource rl ON rl.id = arl.reasoning_level_id AND rl.active = true
         WHERE arl.agent_id = a.id AND arl.active = true LIMIT 1) as reasoning
    FROM agent_artifact a
    LEFT JOIN agent_departments_data add_data ON add_data.agent_id = a.id
    LEFT JOIN agent_departments_junction ad ON ad.agent_id = a.id AND ad.active = true AND ad.department_id IN (SELECT department_id FROM user_departments)
    GROUP BY a.id, a.updated_at,
        add_data.department_ids, add_data.department_link_count
    HAVING COUNT(ad.department_id) > 0 OR NOT EXISTS (
        SELECT 1 FROM agent_departments_junction ad2 WHERE ad2.agent_id = a.id AND ad2.active = true
    )
),
-- Apply server-side filters
filtered_agents AS (
    SELECT ad.*
    FROM agent_data ad
    WHERE
        -- Search filter: match name or description (case-insensitive)
        (search IS NULL OR LOWER(ad.agent_name) LIKE '%' || LOWER(search) || '%' OR LOWER(ad.description) LIKE '%' || LOWER(search) || '%')
        -- Department filter: agent must belong to at least one selected department
        AND (filter_department_ids IS NULL OR ad.department_ids && filter_department_ids::text[])
),
-- Count total filtered results (before pagination)
filtered_count AS (
    SELECT COUNT(*)::bigint as total_count FROM filtered_agents
),
-- Paginate filtered results
paginated_agents AS (
    SELECT fa.*
    FROM filtered_agents fa
    ORDER BY fa.updated_at DESC NULLS LAST
    LIMIT page_size OFFSET page_offset
),
-- Department option IDs with counts (names hydrated in Python)
department_option_data AS (
    SELECT
        dr.id,
        (SELECT COUNT(*) FROM agent_data ad WHERE dr.id::text = ANY(ad.department_ids)) as count
    FROM departments_resource dr
    WHERE dr.id IN (SELECT department_id FROM user_departments)
),
-- Model option IDs with counts (names hydrated in Python)
all_model_ids AS (
    SELECT DISTINCT model_id
    FROM agent_data
    WHERE model_id IS NOT NULL
),
model_option_data AS (
    SELECT
        mr.id,
        (SELECT COUNT(*) FROM agent_data ad WHERE mr.id = ad.model_id) as count
    FROM models_resource mr
    WHERE mr.id IN (SELECT model_id FROM all_model_ids)
)
SELECT
    -- Aggregate paginated agents
    COALESCE(
        (SELECT ARRAY_AGG(
            (pa.agent_id, pa.agent_name, pa.description,
             COALESCE(pa.reasoning, ''),
             COALESCE(pa.temperature, 0.0),
             pa.model_id, pa.role, pa.updated_at,
             COALESCE(pa.department_ids, ARRAY[]::text[]),
             pa.department_link_count
            )::types.q_list_agents_v4_agent
            ORDER BY pa.updated_at DESC NULLS LAST
        ) FROM paginated_agents pa),
        '{}'::types.q_list_agents_v4_agent[]
    ) as agents,
    -- Department option IDs with counts (names hydrated in Python)
    COALESCE(
        (SELECT ARRAY_AGG(
            (dod.id, dod.count)::types.q_list_agents_v4_option_id
        ) FROM department_option_data dod),
        '{}'::types.q_list_agents_v4_option_id[]
    ) as department_option_ids,
    -- Model option IDs with counts (names hydrated in Python)
    COALESCE(
        (SELECT ARRAY_AGG(
            (mod.id, mod.count)::types.q_list_agents_v4_option_id
        ) FROM model_option_data mod),
        '{}'::types.q_list_agents_v4_option_id[]
    ) as model_option_ids,
    -- Total count of filtered agents (before pagination)
    (SELECT total_count FROM filtered_count) as total_count
FROM params
$$;
