-- Get tools list - returns raw data for Python permission computation
-- Permissions (can_edit, can_delete, can_duplicate) computed in Python

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
    active_usage_count bigint,
    total_usage_count bigint,
    updated_at timestamptz
);

-- 4) Recreate function - returns raw data + total_count for Python permission computation
CREATE OR REPLACE FUNCTION api_get_tools_list_v4(
    profile_id uuid,
    search text DEFAULT NULL,
    page_size int DEFAULT 12,
    page_offset int DEFAULT 0
)
RETURNS TABLE (
    tools types.q_get_tools_list_v4_tool[],
    total_count bigint
)
LANGUAGE sql
STABLE
AS $$
-- User context (actor_name, user_role, department_ids) comes from get_profile_context_internal() in Python
WITH params AS (
    SELECT profile_id AS profile_id
),
-- Count usage from all 3 sources (matching delete mutation SQL)
tool_usage_counts AS (
    SELECT
        t.id as tool_id,
        -- active_usage_count: direct call usage (for can_edit)
        COALESCE(
            (SELECT COUNT(*) FROM tools_calls_connection tcj WHERE tcj.tools_id = t.id),
            0
        )::bigint as active_usage_count,
        -- total_usage_count: all 3 sources (for can_delete, matches delete mutation SQL)
        (
            COALESCE((SELECT COUNT(*) FROM tools_calls_connection tcj WHERE tcj.tools_id = t.id), 0) +
            COALESCE((SELECT COUNT(DISTINCT at.agent_id) FROM agent_tools_junction at
                JOIN tools_resource tr ON tr.id = at.tool_id
                JOIN tool_tools_junction ttj ON ttj.tools_id = tr.id
                WHERE ttj.tool_id = t.id AND at.active = true), 0) +
            COALESCE((SELECT COUNT(*) FROM resource_tools_relation rt WHERE rt.tool_id = t.id), 0)
        )::bigint as total_usage_count
    FROM tool_artifact t
),
-- Core tool data
tool_data AS (
    SELECT
        t.id as tool_id,
        (SELECT n.name FROM tool_names_junction tn JOIN names_resource n ON tn.name_id = n.id WHERE tn.tool_id = t.id LIMIT 1) as name,
        (SELECT d.description FROM tool_descriptions_junction td JOIN descriptions_resource d ON td.description_id = d.id WHERE td.tool_id = t.id LIMIT 1) as description,
        EXISTS (SELECT 1 FROM tool_flags_junction tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'tool_active' AND tf.value = true) as active,
        t.updated_at,
        COALESCE(tuc.active_usage_count, 0)::bigint as active_usage_count,
        COALESCE(tuc.total_usage_count, 0)::bigint as total_usage_count
    FROM tool_artifact t
    LEFT JOIN tool_usage_counts tuc ON tuc.tool_id = t.id
),
-- Apply search filter
filtered_tools AS (
    SELECT td.*
    FROM tool_data td
    WHERE (search IS NULL OR LOWER(td.name) LIKE '%' || LOWER(search) || '%')
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
)
SELECT
    COALESCE(
        (SELECT ARRAY_AGG(
            (pt.tool_id, pt.name, pt.description, pt.active,
             pt.active_usage_count, pt.total_usage_count, pt.updated_at
            )::types.q_get_tools_list_v4_tool
            ORDER BY pt.updated_at DESC NULLS LAST
        ) FROM paginated_tools pt),
        '{}'::types.q_get_tools_list_v4_tool[]
    ) as tools,
    (SELECT total_count FROM filtered_count) as total_count
FROM params
$$;
