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
    draft_id uuid DEFAULT NULL,
    draft_group_id uuid DEFAULT NULL,
    draft_version int DEFAULT NULL
)
RETURNS TABLE (
    agent_exists boolean,
    effective_draft_version int,
    group_id uuid,


    -- Agent state for Python permission logic
    agent_department_ids uuid[],
    active_usage_count int
)
LANGUAGE sql
VOLATILE
AS $$
-- User context (actor_name, user_role, department_ids) comes from get_profile_context_internal() in Python
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
-- Create a new group if no draft_group_id provided (guarantees group_id is always returned)
ensure_group AS (
    INSERT INTO groups_entry (created_at, updated_at)
    SELECT NOW(), NOW()
    WHERE draft_group_id IS NULL
    RETURNING id
),
effective_group AS (
    SELECT COALESCE(draft_group_id, (SELECT id FROM ensure_group)) as group_id
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
)
SELECT
    -- Basic metadata
    (SELECT agent_exists FROM agent_exists_check) as agent_exists,
    draft_version as effective_draft_version,
    (SELECT group_id FROM effective_group) as group_id,

    -- User context for Python permission logic

    -- Agent state for Python permission logic
    COALESCE((SELECT department_ids FROM agent_departments_data), ARRAY[]::uuid[]) as agent_department_ids,
    COALESCE(
        (SELECT COUNT(*)::int FROM agent_departments_junction adj WHERE adj.agent_id = (SELECT agent_id FROM params) AND adj.active = true),
        0
    ) as active_usage_count
FROM params x;
$$;
