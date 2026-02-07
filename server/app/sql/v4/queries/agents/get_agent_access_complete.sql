-- Agent Access Check (Query 1 of Two-Pass Architecture)
-- Returns user context and agent state for Python to compute permissions
-- This query runs FIRST, before ID fetching

-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_get_agent_access_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_agent_access_v4(%s)', r.sig);
    END LOOP;
END $$;

-- Create function
CREATE OR REPLACE FUNCTION api_get_agent_access_v4(
    profile_id uuid,
    agent_id uuid DEFAULT NULL,
    draft_id uuid DEFAULT NULL
)
RETURNS TABLE (
    -- Basic metadata
    actor_name text,
    agent_exists boolean,
    draft_version int,
    group_id uuid,

    -- User context for Python permission logic
    user_role text,
    user_department_ids uuid[],

    -- Agent state for Python permission logic
    agent_department_ids uuid[],
    active_usage_count int
)
LANGUAGE sql
STABLE
AS $$
WITH params AS (
    SELECT
        profile_id AS profile_id,
        agent_id AS agent_id,
        draft_id AS draft_id
),
-- Check if agent exists
agent_exists_check AS (
    SELECT
        CASE
            WHEN (SELECT agent_id FROM params) IS NULL THEN NULL::boolean
            ELSE EXISTS(SELECT 1 FROM agent_artifact WHERE id = (SELECT agent_id FROM params))::boolean
        END as agent_exists
),
-- Get user profile info
user_profile AS (
    SELECT role, actor_name
    FROM view_user_profile_context
    WHERE profile_id = (SELECT profile_id FROM params)
),
-- Get user's departments
user_departments AS (
    SELECT COALESCE(
        ARRAY_AGG(DISTINCT pd.department_id) FILTER (WHERE pd.department_id IS NOT NULL),
        ARRAY[]::uuid[]
    ) as department_ids
    FROM params x
    LEFT JOIN profile_departments_junction pd ON pd.profile_id = x.profile_id AND pd.active = true
),
-- Get agent's departments (only if agent_id provided)
agent_departments_data AS (
    SELECT COALESCE(
        ARRAY_AGG(ad.department_id ORDER BY ad.created_at) FILTER (WHERE ad.department_id IS NOT NULL),
        ARRAY[]::uuid[]
    ) as department_ids
    FROM params x
    LEFT JOIN agent_departments_junction ad ON ad.agent_id = x.agent_id AND ad.active = true
    WHERE x.agent_id IS NOT NULL
),
-- Get group_id from draft or fallback to most recent group
draft_group_data AS (
    SELECT
        COALESCE(
            (SELECT dde.group_id FROM view_drafts_entry d JOIN draft_domains_entry dde ON dde.draft_id = d.id AND dde.active = TRUE WHERE d.id = (SELECT draft_id FROM params)),
            (SELECT id FROM view_groups_entry ORDER BY created_at DESC LIMIT 1)
        ) as group_id
    FROM params
    LIMIT 1
),
-- Draft version
draft_version_data AS (
    SELECT d.version as draft_version
    FROM params x
    LEFT JOIN view_drafts_entry d ON d.id = x.draft_id
    WHERE TRUE
    LIMIT 1
)
SELECT
    -- Basic metadata
    up.actor_name::text as actor_name,
    (SELECT agent_exists FROM agent_exists_check) as agent_exists,
    (SELECT draft_version FROM draft_version_data) as draft_version,
    dgd.group_id,

    -- User context for Python permission logic
    up.role::text as user_role,
    ud.department_ids as user_department_ids,

    -- Agent state for Python permission logic
    COALESCE((SELECT department_ids FROM agent_departments_data), ARRAY[]::uuid[]) as agent_department_ids,
    COALESCE(
        (SELECT COUNT(*)::int FROM agent_departments_junction adj WHERE adj.agent_id = (SELECT agent_id FROM params) AND adj.active = true),
        0
    ) as active_usage_count
FROM params x
CROSS JOIN user_profile up
CROSS JOIN user_departments ud
CROSS JOIN draft_group_data dgd;
$$;
