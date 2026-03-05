-- Eval Access Check (Query 1 of Two-Pass Architecture)
-- Returns user context and eval state for Python to compute permissions
-- This query runs FIRST, before ID fetching

-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_get_eval_access_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_eval_access_v4(%s)', r.sig);
    END LOOP;
END $$;

-- Create function
CREATE OR REPLACE FUNCTION api_get_eval_access_v4(
    profile_id uuid,
    eval_id uuid DEFAULT NULL,
    draft_id uuid DEFAULT NULL,
    draft_group_id uuid DEFAULT NULL,
    draft_version int DEFAULT NULL
)
RETURNS TABLE (
    eval_exists boolean,
    effective_draft_version int,
    group_id uuid,


    -- Eval state for Python permission logic
    eval_department_ids uuid[],
    active_usage_count int
)
LANGUAGE sql
VOLATILE
AS $$
-- User context (actor_name, user_role, department_ids) comes from get_profile_context_internal() in Python
WITH params AS (
    SELECT
        eval_id AS eval_id,
        profile_id AS profile_id,
        draft_id AS draft_id
),
-- Check if eval exists
eval_exists_check AS (
    SELECT
        CASE
            WHEN (SELECT eval_id FROM params) IS NULL THEN NULL::boolean
            ELSE EXISTS(SELECT 1 FROM eval_artifact WHERE id = (SELECT eval_id FROM params))::boolean
        END as eval_exists
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
-- Get eval departments (for access check)
eval_departments_data AS (
    SELECT COALESCE(
        ARRAY_AGG(ed.departments_id ORDER BY ed.created_at) FILTER (WHERE ed.departments_id IS NOT NULL),
        ARRAY[]::uuid[]
    ) as department_ids
    FROM params x
    LEFT JOIN eval_departments_junction ed ON ed.eval_id = x.eval_id AND ed.active = true
    WHERE x.eval_id IS NOT NULL
),
-- Get eval active usage count (benchmarks using this eval)
eval_usage_state AS (
    SELECT 0::int as active_usage_count
    FROM params
    LIMIT 1
)
SELECT
    -- Basic metadata
    (SELECT eval_exists FROM eval_exists_check) as eval_exists,
    draft_version as effective_draft_version,
    (SELECT group_id FROM effective_group) as group_id,

    -- User context for Python permission logic

    -- Eval state for Python permission logic
    COALESCE((SELECT department_ids FROM eval_departments_data), ARRAY[]::uuid[]) as eval_department_ids,
    COALESCE((SELECT active_usage_count FROM eval_usage_state), 0) as active_usage_count
FROM params x;
$$;

