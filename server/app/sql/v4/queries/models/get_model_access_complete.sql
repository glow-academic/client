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
    draft_id uuid DEFAULT NULL
)
RETURNS TABLE (
    model_exists boolean,
    draft_version int,
    group_id uuid,


    -- Model state for Python permission logic
    model_department_ids uuid[],
    active_persona_count int
)
LANGUAGE sql
STABLE
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
-- Resolve canonical model group context (draft override handled in Python service layer)
model_group_data AS (
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
    (SELECT draft_version FROM draft_version_data) as draft_version,
    mgd.group_id,

    -- User context for Python permission logic

    -- Model state for Python permission logic
    COALESCE((SELECT department_ids FROM model_departments_data), ARRAY[]::uuid[]) as model_department_ids,
    COALESCE((SELECT active_persona_count FROM model_persona_count), 0) as active_persona_count
FROM params x
CROSS JOIN model_group_data mgd;
$$;

