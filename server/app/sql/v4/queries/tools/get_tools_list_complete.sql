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
    num_schemas int,
    num_templates int,
    active_usage_count int,
    total_usage_count int,
    updated_at timestamptz
);

-- 4) Recreate function - returns raw data + user_role for Python permission computation
CREATE OR REPLACE FUNCTION api_get_tools_list_v4(profile_id uuid)
RETURNS TABLE (
    actor_name text,
    user_role text,
    tools types.q_get_tools_list_v4_tool[]
)
LANGUAGE sql
STABLE
AS $$
WITH params AS (
    SELECT profile_id AS profile_id
),
user_profile AS (
    SELECT role, COALESCE(NULLIF(actor_name, ''), 'System') as actor_name
    FROM view_user_profile_context
    WHERE profile_id = (SELECT profile_id FROM params)
),
tool_args_counts AS (
    SELECT
        ta.tool_id,
        COUNT(*) as num_schemas
    FROM tool_args_junction ta
    GROUP BY ta.tool_id
),
tool_args_outputs_counts AS (
    SELECT
        tao.tool_id,
        COUNT(*) as num_templates
    FROM tool_args_outputs_junction tao
    GROUP BY tao.tool_id
),
tool_usage_counts AS (
    SELECT
        t.id as tool_id,
        COALESCE(
            (SELECT COUNT(*) FROM tool_calls_junction tcj WHERE tcj.tool_id = t.id),
            0
        )::int as active_usage_count,
        COALESCE(
            (SELECT COUNT(*) FROM tool_calls_junction tcj WHERE tcj.tool_id = t.id),
            0
        )::int as total_usage_count
    FROM tool_artifact t
),
tool_data AS (
    SELECT
        t.id as tool_id,
        (SELECT n.name FROM tool_names_junction tn JOIN names_resource n ON tn.name_id = n.id WHERE tn.tool_id = t.id LIMIT 1) as name,
        (SELECT d.description FROM tool_descriptions_junction td JOIN descriptions_resource d ON td.description_id = d.id WHERE td.tool_id = t.id LIMIT 1) as description,
        EXISTS (SELECT 1 FROM tool_flags_junction tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'tool_active' AND tf.value = true) as active,
        t.updated_at,
        COALESCE(tac.num_schemas, 0)::int as num_schemas,
        COALESCE(taoc.num_templates, 0)::int as num_templates,
        COALESCE(tuc.active_usage_count, 0)::int as active_usage_count,
        COALESCE(tuc.total_usage_count, 0)::int as total_usage_count
    FROM tool_artifact t
    LEFT JOIN tool_args_counts tac ON tac.tool_id = t.id
    LEFT JOIN tool_args_outputs_counts taoc ON taoc.tool_id = t.id
    LEFT JOIN tool_usage_counts tuc ON tuc.tool_id = t.id
)
SELECT
    up.actor_name::text as actor_name,
    up.role::text as user_role,
    COALESCE(
        (SELECT ARRAY_AGG(
            (td.tool_id, td.name, td.description, td.active, td.num_schemas,
             td.num_templates, td.active_usage_count, td.total_usage_count, td.updated_at
            )::types.q_get_tools_list_v4_tool
            ORDER BY td.updated_at DESC NULLS LAST
        ) FROM tool_data td),
        '{}'::types.q_get_tools_list_v4_tool[]
    ) as tools
FROM user_profile up
$$;
