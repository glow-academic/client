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
    draft_id uuid DEFAULT NULL,
    draft_group_id uuid DEFAULT NULL,
    draft_version int DEFAULT NULL
)
RETURNS TABLE (
    tool_exists boolean,
    effective_draft_version int,
    group_id uuid,


    -- Tool state for Python permission logic
    active_usage_count int
)
LANGUAGE sql
VOLATILE
AS $$
-- User context (actor_name, user_role, department_ids) comes from get_profile_context_internal() in Python
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
-- Create a new group if no draft_group_id provided (guarantees group_id is always returned)
ensure_group AS (
    INSERT INTO groups_entry (created_at)
    SELECT NOW()
    WHERE draft_group_id IS NULL
    RETURNING id
),
effective_group AS (
    SELECT COALESCE(draft_group_id, (SELECT id FROM ensure_group)) as group_id
),
-- Get tool active usage count (agents using this tool)
tool_usage_data AS (
    SELECT
        COALESCE(
            (SELECT COUNT(DISTINCT at.agent_id)::int
             FROM agent_tools_junction at
             JOIN tools_resource tr ON tr.id = at.tools_id
             JOIN tool_tools_junction ttj ON ttj.tool_id = tr.id
             WHERE ttj.tool_id = (SELECT tool_id FROM params)
               AND at.active = true),
            0
        ) as active_usage_count
    FROM params x
    WHERE x.tool_id IS NOT NULL
)
SELECT
    -- Basic metadata
    (SELECT tool_exists FROM tool_exists_check) as tool_exists,
    draft_version as effective_draft_version,
    (SELECT group_id FROM effective_group) as group_id,

    -- User context for Python permission logic

    -- Tool state for Python permission logic
    COALESCE((SELECT active_usage_count FROM tool_usage_data), 0) as active_usage_count
FROM params x;
$$;

