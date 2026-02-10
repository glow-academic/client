-- Tool Access Check (Query 1 of Two-Pass Architecture)
-- Returns user context and tool state for Python to compute permissions
-- This query runs FIRST, before ID fetching

-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_get_tool_access_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_tool_access_v4(%s)', r.sig);
    END LOOP;
END $$;

-- Create function
CREATE OR REPLACE FUNCTION api_get_tool_access_v4(
    profile_id uuid,
    tool_id uuid DEFAULT NULL,
    draft_id uuid DEFAULT NULL
)
RETURNS TABLE (
    -- Basic metadata
    actor_name text,
    tool_exists boolean,
    draft_version int,
    group_id uuid,

    -- User context for Python permission logic
    user_role text,

    -- Tool state for Python permission logic
    active_usage_count int
)
LANGUAGE sql
STABLE
AS $$
WITH params AS (
    SELECT
        tool_id AS tool_id,
        profile_id AS profile_id,
        draft_id AS draft_id
),
-- Check if tool exists
tool_exists_check AS (
    SELECT
        CASE
            WHEN (SELECT tool_id FROM params) IS NULL THEN NULL::boolean
            ELSE EXISTS(SELECT 1 FROM tool_artifact WHERE id = (SELECT tool_id FROM params))::boolean
        END as tool_exists
),
-- Get user profile info
user_profile AS (
    SELECT role, actor_name
    FROM view_user_profile_context
    WHERE profile_id = (SELECT profile_id FROM params)
),
-- Resolve canonical tool group context (draft override handled in Python service layer)
tool_group_data AS (
    SELECT
        (
            SELECT gr.id
            FROM groups_resource gr
            WHERE gr.active = true
            ORDER BY gr.created_at DESC
            LIMIT 1
        ) as group_id
    FROM params x
    WHERE TRUE
    LIMIT 1
),
-- Draft version is resolved in Python via internal draft fetch layer
draft_version_data AS (
    SELECT NULL::int as draft_version
),
-- Get tool active usage count (agents using this tool)
tool_usage_data AS (
    SELECT
        COALESCE(
            (SELECT COUNT(DISTINCT at.agent_id)::int
             FROM agent_tools_junction at
             JOIN tools_resource tr ON tr.id = at.tool_id
             JOIN tool_tools_junction ttj ON ttj.tools_id = tr.id
             WHERE ttj.tool_id = (SELECT tool_id FROM params)
               AND at.active = true),
            0
        ) as active_usage_count
    FROM params x
    WHERE x.tool_id IS NOT NULL
)
SELECT
    -- Basic metadata
    up.actor_name::text as actor_name,
    (SELECT tool_exists FROM tool_exists_check) as tool_exists,
    (SELECT draft_version FROM draft_version_data) as draft_version,
    tgd.group_id,

    -- User context for Python permission logic
    up.role::text as user_role,

    -- Tool state for Python permission logic
    COALESCE((SELECT active_usage_count FROM tool_usage_data), 0) as active_usage_count
FROM params x
CROSS JOIN user_profile up
CROSS JOIN tool_group_data tgd;
$$;
