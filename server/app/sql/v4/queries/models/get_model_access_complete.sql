-- Model Access Check (Query 1 of Two-Pass Architecture)
-- Returns user context and model state for Python to compute permissions
-- This query runs FIRST, before ID fetching

-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_get_model_access_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_model_access_v4(%s)', r.sig);
    END LOOP;
END $$;

-- Create function
CREATE OR REPLACE FUNCTION api_get_model_access_v4(
    profile_id uuid,
    model_id uuid DEFAULT NULL,
    draft_id uuid DEFAULT NULL,
    draft_group_id uuid DEFAULT NULL,
    draft_version int DEFAULT NULL
)
RETURNS TABLE (
    model_exists boolean,
    effective_draft_version int,
    group_id uuid,


    -- Model state for Python permission logic
    model_department_ids uuid[],
    active_persona_count int
)
LANGUAGE sql
VOLATILE
AS $$
-- User context (actor_name, user_role, department_ids) comes from get_profile_context_internal() in Python
WITH params AS (
    SELECT
        model_id AS model_id,
        profile_id AS profile_id,
        draft_id AS draft_id
),
-- Check if model exists
model_exists_check AS (
    SELECT
        CASE
            WHEN (SELECT model_id FROM params) IS NULL THEN NULL::boolean
            ELSE EXISTS(SELECT 1 FROM model_artifact WHERE id = (SELECT model_id FROM params))::boolean
        END as model_exists
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
-- Get model departments (for access check)
model_departments_data AS (
    SELECT COALESCE(
        ARRAY_AGG(md.department_id ORDER BY md.created_at) FILTER (WHERE md.department_id IS NOT NULL),
        ARRAY[]::uuid[]
    ) as department_ids
    FROM params x
    LEFT JOIN model_departments_junction md ON md.model_id = x.model_id AND md.active = true
    WHERE x.model_id IS NOT NULL
),
-- Persona-model direct link removed (migration 44)
-- Always returns 0 since personas are no longer directly linked to models
model_persona_count AS (
    SELECT 0::int as active_persona_count
)
SELECT
    -- Basic metadata
    (SELECT model_exists FROM model_exists_check) as model_exists,
    draft_version as effective_draft_version,
    (SELECT group_id FROM effective_group) as group_id,

    -- User context for Python permission logic

    -- Model state for Python permission logic
    COALESCE((SELECT department_ids FROM model_departments_data), ARRAY[]::uuid[]) as model_department_ids,
    COALESCE((SELECT active_persona_count FROM model_persona_count), 0) as active_persona_count
FROM params x;
$$;

