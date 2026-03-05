-- Get tools list - returns raw data for Python permission computation
-- Permissions (can_edit, can_delete, can_duplicate) computed in Python
-- Filter option names resolved in SQL via ListFilterSection pattern

-- 1) Drop function first (breaks dependency on types)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_get_tools_list_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_tools_list_v4(%s)', r.sig);
    END LOOP;
END $$;

-- 2) Drop types WITHOUT CASCADE
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT typname
        FROM pg_type
        WHERE typname LIKE 'q_get_tools_list_v4_%'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I', r.typname);
    END LOOP;
END $$;

-- 3) Recreate types - raw data without computed permissions
CREATE TYPE types.q_get_tools_list_v4_tool AS (
    tool_id uuid,
    name text,
    description text,
    active boolean,
    active_agent_count bigint,
    updated_at timestamptz,
    department_ids text[]
);

-- Filter option type: value/label/count (names resolved in SQL, no Python hydration needed)
CREATE TYPE types.q_get_tools_list_v4_option AS (
    value text,
    label text,
    count bigint
);

-- 4) Recreate function - returns raw data + filter options + total_count
CREATE OR REPLACE FUNCTION api_get_tools_list_v4(
    profile_id uuid,
    search text DEFAULT NULL,
    filter_department_ids uuid[] DEFAULT NULL,
    filter_agent_ids uuid[] DEFAULT NULL,
    filter_creatable text[] DEFAULT NULL,
    department_search text DEFAULT NULL,
    agent_search text DEFAULT NULL,
    page_size int DEFAULT 12,
    page_offset int DEFAULT 0
)
RETURNS TABLE (
    tools types.q_get_tools_list_v4_tool[],
    department_options types.q_get_tools_list_v4_option[],
    agent_options types.q_get_tools_list_v4_option[],
    creatable_options types.q_get_tools_list_v4_option[],
    total_count bigint
)
LANGUAGE sql
STABLE
AS $$
-- User context (actor_name, user_role, department_ids) comes from get_profile_context_internal() in Python
WITH params AS (
    SELECT profile_id AS profile_id
),
user_departments AS (
    SELECT department_id
    FROM params x
    JOIN profile_departments_junction ON profile_departments_junction.profile_id = x.profile_id AND profile_departments_junction.active = true
),
-- Department IDs per tool
tool_departments_data AS (
    SELECT
        tdj.tool_id,
        ARRAY_AGG(tdj.department_id::text ORDER BY tdj.created_at) as department_ids
    FROM tool_departments_junction tdj
    WHERE tdj.active = true
    GROUP BY tdj.tool_id
),
-- Count active agent links (immediate parent only)
tool_agent_counts AS (
    SELECT
        t.id as tool_id,
        COALESCE(
            (SELECT COUNT(DISTINCT atj.agent_id) FROM agent_tools_junction atj
                JOIN tools_resource tr ON tr.id = atj.tool_id
                JOIN tool_tools_junction ttj ON ttj.tool_id = tr.id
                WHERE ttj.tool_id = t.id AND atj.active = true),
            0
        )::bigint as active_agent_count
    FROM tool_artifact t
),
-- Agent IDs per tool (for filtering)
tool_agents_data AS (
    SELECT
        ttj.tool_id,
        ARRAY_AGG(DISTINCT atj.agent_id) as agent_ids
    FROM tool_tools_junction ttj
    JOIN tools_resource tr ON tr.id = ttj.tool_id AND tr.active = true
    JOIN agent_tools_junction atj ON atj.tool_id = tr.id AND atj.active = true
    GROUP BY ttj.tool_id
),
-- Creatable flag per tool (derived from tools_resource.operation)
tool_creatable_data AS (
    SELECT
        ttj.tool_id,
        (tr.operation = 'create') as is_creatable
    FROM tool_tools_junction ttj
    JOIN tools_resource tr ON tr.id = ttj.tool_id AND tr.active = true
),
-- Core tool data
tool_data AS (
    SELECT
        t.id as tool_id,
        (SELECT n.name FROM tool_names_junction tn JOIN names_resource n ON tn.names_id = n.id WHERE tn.tool_id = t.id LIMIT 1) as name,
        (SELECT d.description FROM tool_descriptions_junction td JOIN descriptions_resource d ON td.descriptions_id = d.id WHERE td.tool_id = t.id LIMIT 1) as description,
        EXISTS (SELECT 1 FROM tool_flags_junction tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'tool_active' AND f.value = true) as active,
        t.updated_at,
        COALESCE(tac.active_agent_count, 0)::bigint as active_agent_count,
        COALESCE(tdd.department_ids, ARRAY[]::text[]) as department_ids,
        COALESCE(tad.agent_ids, ARRAY[]::uuid[]) as agent_ids,
        COALESCE(tcd.is_creatable, false) as is_creatable
    FROM tool_artifact t
    LEFT JOIN tool_agent_counts tac ON tac.tool_id = t.id
    LEFT JOIN tool_departments_data tdd ON tdd.tool_id = t.id
    LEFT JOIN tool_agents_data tad ON tad.tool_id = t.id
    LEFT JOIN tool_creatable_data tcd ON tcd.tool_id = t.id
),
-- Apply search and filters
filtered_tools AS (
    SELECT td.*
    FROM tool_data td
    WHERE
        (search IS NULL OR LOWER(td.name) LIKE '%' || LOWER(search) || '%')
        -- Department filter
        AND (filter_department_ids IS NULL OR td.department_ids && filter_department_ids::text[])
        -- Agent filter
        AND (filter_agent_ids IS NULL OR td.agent_ids && filter_agent_ids)
        -- Creatable filter
        AND (filter_creatable IS NULL OR (td.is_creatable AND 'true' = ANY(filter_creatable)) OR (NOT td.is_creatable AND 'false' = ANY(filter_creatable)))
),
-- Count total filtered results (before pagination)
filtered_count AS (
    SELECT COUNT(*)::bigint as total_count FROM filtered_tools
),
-- Paginate filtered results
paginated_tools AS (
    SELECT ft.*
    FROM filtered_tools ft
    ORDER BY ft.updated_at DESC NULLS LAST
    LIMIT page_size OFFSET page_offset
),
-- Department options with names resolved in SQL
department_option_data AS (
    SELECT
        dr.id::text as value,
        (SELECT n.name FROM department_names_junction dn JOIN names_resource n ON n.id = dn.names_id WHERE dn.department_id = dd.department_id LIMIT 1) as label,
        (SELECT COUNT(*) FROM tool_data td WHERE dr.id::text = ANY(td.department_ids)) as count
    FROM departments_resource dr
    JOIN department_departments_junction dd ON dd.department_id = dr.id
    WHERE dr.id IN (SELECT department_id FROM user_departments)
      AND (department_search IS NULL OR LOWER((SELECT n.name FROM department_names_junction dn JOIN names_resource n ON n.id = dn.names_id WHERE dn.department_id = dd.department_id LIMIT 1)) LIKE '%' || LOWER(department_search) || '%')
),
-- Agent options with names resolved in SQL
all_agent_ids AS (
    SELECT DISTINCT unnest(agent_ids) as agent_id
    FROM tool_data
    WHERE agent_ids IS NOT NULL AND array_length(agent_ids, 1) > 0
),
agent_option_data AS (
    SELECT
        aa.id::text as value,
        (SELECT n.name FROM agent_names_junction an JOIN names_resource n ON n.id = an.names_id WHERE an.agent_id = aa.id LIMIT 1) as label,
        (SELECT COUNT(*) FROM tool_data td WHERE aa.id = ANY(td.agent_ids)) as count
    FROM agent_artifact aa
    WHERE aa.id IN (SELECT agent_id FROM all_agent_ids)
      AND (agent_search IS NULL OR LOWER((SELECT n.name FROM agent_names_junction an JOIN names_resource n ON n.id = an.names_id WHERE an.agent_id = aa.id LIMIT 1)) LIKE '%' || LOWER(agent_search) || '%')
),
-- Creatable options with counts
creatable_option_data AS (
    SELECT * FROM (VALUES
        ('true', 'Creatable', (SELECT COUNT(*) FROM tool_data WHERE is_creatable = true)::bigint),
        ('false', 'Linkable', (SELECT COUNT(*) FROM tool_data WHERE is_creatable = false)::bigint)
    ) AS t(value, label, count)
)
SELECT
    COALESCE(
        (SELECT ARRAY_AGG(
            (pt.tool_id, pt.name, pt.description, pt.active,
             pt.active_agent_count, pt.updated_at, pt.department_ids
            )::types.q_get_tools_list_v4_tool
            ORDER BY pt.updated_at DESC NULLS LAST
        ) FROM paginated_tools pt),
        '{}'::types.q_get_tools_list_v4_tool[]
    ) as tools,
    -- Department options (names resolved in SQL)
    COALESCE(
        (SELECT ARRAY_AGG(
            (dod.value, dod.label, dod.count)::types.q_get_tools_list_v4_option
            ORDER BY dod.label
        ) FROM department_option_data dod),
        '{}'::types.q_get_tools_list_v4_option[]
    ) as department_options,
    -- Agent options (names resolved in SQL)
    COALESCE(
        (SELECT ARRAY_AGG(
            (aod.value, aod.label, aod.count)::types.q_get_tools_list_v4_option
            ORDER BY aod.label
        ) FROM agent_option_data aod),
        '{}'::types.q_get_tools_list_v4_option[]
    ) as agent_options,
    -- Creatable options with counts
    (SELECT ARRAY_AGG(
        (cod.value, cod.label, cod.count)::types.q_get_tools_list_v4_option
    ) FROM creatable_option_data cod) as creatable_options,
    (SELECT total_count FROM filtered_count) as total_count
FROM params
$$;
