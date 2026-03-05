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
    active_settings_count bigint
);

-- Filter option type: value/label/count (names resolved in SQL, no Python hydration needed)
CREATE TYPE types.q_list_agents_v4_option AS (
    value text,
    label text,
    count bigint
);

-- 4) Recreate function
CREATE OR REPLACE FUNCTION api_list_agents_v4(
    profile_id uuid,
    search text DEFAULT NULL,
    filter_department_ids uuid[] DEFAULT NULL,
    filter_model_ids uuid[] DEFAULT NULL,
    filter_tool_ids uuid[] DEFAULT NULL,
    department_search text DEFAULT NULL,
    model_search text DEFAULT NULL,
    tool_search text DEFAULT NULL,
    page_size int DEFAULT 12,
    page_offset int DEFAULT 0
)
RETURNS TABLE (
    agents types.q_list_agents_v4_agent[],
    department_options types.q_list_agents_v4_option[],
    model_options types.q_list_agents_v4_option[],
    tool_options types.q_list_agents_v4_option[],
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
        ARRAY_AGG(ad.department_id::text ORDER BY ad.created_at) as department_ids
    FROM agent_departments_junction ad
    WHERE ad.active = true
    GROUP BY ad.agent_id
),
-- Active settings count per agent (via runs_agents_connection)
agent_settings_data AS (
    SELECT
        aaj.agent_id,
        COUNT(DISTINCT rac.run_id)::bigint as active_settings_count
    FROM agent_agents_junction aaj
    JOIN runs_agents_connection rac ON rac.agents_id = aaj.agents_id AND rac.active = true
    WHERE aaj.active = true
    GROUP BY aaj.agent_id
),
-- Tool IDs per agent (for filtering)
agent_tools_data AS (
    SELECT
        atj.agent_id,
        ARRAY_AGG(DISTINCT ttj.tool_id) as tool_ids
    FROM agent_tools_junction atj
    JOIN tools_resource tr ON tr.id = atj.tool_id AND tr.active = true
    JOIN tool_tools_junction ttj ON ttj.tool_id = tr.id
    WHERE atj.active = true
    GROUP BY atj.agent_id
),
agent_data AS (
    SELECT
        a.id as agent_id,
        (SELECT n.name FROM agent_names_junction an JOIN names_resource n ON an.names_id = n.id WHERE an.agent_id = a.id LIMIT 1) as agent_name,
        (SELECT d.description FROM agent_descriptions_junction ad JOIN descriptions_resource d ON ad.descriptions_id = d.id WHERE ad.agent_id = a.id LIMIT 1) as description,
        -- Model from agents_resource
        (SELECT ar.model_id FROM agents_resource ar
         WHERE ar.id = a.id AND ar.model_id IS NOT NULL LIMIT 1) as model_id,
        ''::text as role,
        a.updated_at,
        COALESCE(add_data.department_ids, NULL) as department_ids,
        COALESCE(asd.active_settings_count, 0) as active_settings_count,
        COALESCE(atd.tool_ids, ARRAY[]::uuid[]) as tool_ids,
        -- Temperature and reasoning from agents_resource
        (SELECT ar.temperature FROM agents_resource ar WHERE ar.id = a.id LIMIT 1) as temperature,
        (SELECT ar.reasoning FROM agents_resource ar WHERE ar.id = a.id LIMIT 1) as reasoning
    FROM agent_artifact a
    LEFT JOIN agent_departments_data add_data ON add_data.agent_id = a.id
    LEFT JOIN agent_settings_data asd ON asd.agent_id = a.id
    LEFT JOIN agent_tools_data atd ON atd.agent_id = a.id
    LEFT JOIN agent_departments_junction ad ON ad.agent_id = a.id AND ad.active = true AND ad.department_id IN (SELECT department_id FROM user_departments)
    GROUP BY a.id, a.updated_at,
        add_data.department_ids, asd.active_settings_count, atd.tool_ids
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
        -- Model filter: agent must use one of the selected models
        AND (filter_model_ids IS NULL OR ad.model_id = ANY(filter_model_ids))
        -- Tool filter: agent must use one of the selected tools
        AND (filter_tool_ids IS NULL OR ad.tool_ids && filter_tool_ids)
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
-- Department options with names resolved in SQL
department_option_data AS (
    SELECT
        dr.id::text as value,
        (SELECT n.name FROM department_names_junction dn JOIN names_resource n ON n.id = dn.names_id WHERE dn.department_id = dd.department_id LIMIT 1) as label,
        (SELECT COUNT(*) FROM agent_data ad WHERE dr.id::text = ANY(ad.department_ids)) as count
    FROM departments_resource dr
    JOIN department_departments_junction dd ON dd.department_id = dr.id
    WHERE dr.id IN (SELECT department_id FROM user_departments)
      AND (department_search IS NULL OR LOWER((SELECT n.name FROM department_names_junction dn JOIN names_resource n ON n.id = dn.names_id WHERE dn.department_id = dd.department_id LIMIT 1)) LIKE '%' || LOWER(department_search) || '%')
),
-- Model options with names resolved in SQL
all_model_ids AS (
    SELECT DISTINCT model_id
    FROM agent_data
    WHERE model_id IS NOT NULL
),
model_option_data AS (
    SELECT
        mr.id::text as value,
        (SELECT n.name FROM model_names_junction mn JOIN names_resource n ON n.id = mn.names_id WHERE mn.model_id = mm.model_id LIMIT 1) as label,
        (SELECT COUNT(*) FROM agent_data ad WHERE mr.id = ad.model_id) as count
    FROM models_resource mr
    JOIN model_models_junction mm ON mm.model_id = mr.id
    WHERE mr.id IN (SELECT model_id FROM all_model_ids)
      AND (model_search IS NULL OR LOWER((SELECT n.name FROM model_names_junction mn JOIN names_resource n ON n.id = mn.names_id WHERE mn.model_id = mm.model_id LIMIT 1)) LIKE '%' || LOWER(model_search) || '%')
),
-- Tool options with names resolved in SQL
all_tool_ids AS (
    SELECT DISTINCT unnest(tool_ids) as tool_id
    FROM agent_data
    WHERE tool_ids IS NOT NULL AND array_length(tool_ids, 1) > 0
),
tool_option_data AS (
    SELECT
        ta.id::text as value,
        (SELECT n.name FROM tool_names_junction tn JOIN names_resource n ON n.id = tn.names_id WHERE tn.tool_id = ta.id LIMIT 1) as label,
        (SELECT COUNT(*) FROM agent_data ad WHERE ta.id = ANY(ad.tool_ids)) as count
    FROM tool_artifact ta
    WHERE ta.id IN (SELECT tool_id FROM all_tool_ids)
      AND (tool_search IS NULL OR LOWER((SELECT n.name FROM tool_names_junction tn JOIN names_resource n ON n.id = tn.names_id WHERE tn.tool_id = ta.id LIMIT 1)) LIKE '%' || LOWER(tool_search) || '%')
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
             pa.active_settings_count
            )::types.q_list_agents_v4_agent
            ORDER BY pa.updated_at DESC NULLS LAST
        ) FROM paginated_agents pa),
        '{}'::types.q_list_agents_v4_agent[]
    ) as agents,
    -- Department options (names resolved in SQL)
    COALESCE(
        (SELECT ARRAY_AGG(
            (dod.value, dod.label, dod.count)::types.q_list_agents_v4_option
            ORDER BY dod.label
        ) FROM department_option_data dod),
        '{}'::types.q_list_agents_v4_option[]
    ) as department_options,
    -- Model options (names resolved in SQL)
    COALESCE(
        (SELECT ARRAY_AGG(
            (mod.value, mod.label, mod.count)::types.q_list_agents_v4_option
            ORDER BY mod.label
        ) FROM model_option_data mod),
        '{}'::types.q_list_agents_v4_option[]
    ) as model_options,
    -- Tool options (names resolved in SQL)
    COALESCE(
        (SELECT ARRAY_AGG(
            (tod.value, tod.label, tod.count)::types.q_list_agents_v4_option
            ORDER BY tod.label
        ) FROM tool_option_data tod),
        '{}'::types.q_list_agents_v4_option[]
    ) as tool_options,
    -- Total count of filtered agents (before pagination)
    (SELECT total_count FROM filtered_count) as total_count
FROM params
$$;
