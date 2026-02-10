-- Provider Access Check (Query 1 of Two-Pass Architecture)
-- Returns user context and provider state for Python to compute permissions
-- This query runs FIRST, before ID fetching

-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_get_provider_access_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_provider_access_v4(%s)', r.sig);
    END LOOP;
END $$;

-- Create function
CREATE OR REPLACE FUNCTION api_get_provider_access_v4(
    profile_id uuid,
    provider_id uuid DEFAULT NULL,
    draft_id uuid DEFAULT NULL
)
RETURNS TABLE (
    -- Basic metadata
    actor_name text,
    provider_exists boolean,
    draft_version int,
    group_id uuid,

    -- User context for Python permission logic
    user_role text,
    user_department_ids uuid[],

    -- Provider state for Python permission logic
    provider_department_ids uuid[],
    model_usage_count int
)
LANGUAGE sql
STABLE
AS $$
WITH params AS (
    SELECT
        provider_id AS provider_id,
        profile_id AS profile_id,
        draft_id AS draft_id
),
-- Check if provider exists
provider_exists_check AS (
    SELECT
        CASE
            WHEN (SELECT provider_id FROM params) IS NULL THEN NULL::boolean
            ELSE EXISTS(SELECT 1 FROM provider_artifact WHERE id = (SELECT provider_id FROM params))::boolean
        END as provider_exists
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
-- Resolve canonical provider group context (draft override handled in Python service layer)
provider_group_data AS (
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
-- Get provider departments (for access check)
provider_departments_data AS (
    SELECT COALESCE(
        ARRAY_AGG(pd.department_id ORDER BY pd.created_at) FILTER (WHERE pd.department_id IS NOT NULL),
        ARRAY[]::uuid[]
    ) as department_ids
    FROM params x
    LEFT JOIN provider_departments_junction pd ON pd.provider_id = x.provider_id AND pd.active = true
    WHERE x.provider_id IS NOT NULL
),
-- Get model usage count (how many models use this provider)
model_usage_data AS (
    SELECT COALESCE(
        (
            SELECT COUNT(DISTINCT mr.id)::int
            FROM provider_providers_junction ppj
            JOIN models_resource mr ON mr.provider_id = ppj.providers_id AND mr.active = true
            WHERE ppj.provider_id = (SELECT provider_id FROM params)
        ),
        0
    ) as model_usage_count
)
SELECT
    -- Basic metadata
    up.actor_name::text as actor_name,
    (SELECT provider_exists FROM provider_exists_check) as provider_exists,
    (SELECT draft_version FROM draft_version_data) as draft_version,
    pgd.group_id,

    -- User context for Python permission logic
    up.role::text as user_role,
    ud.department_ids as user_department_ids,

    -- Provider state for Python permission logic
    COALESCE((SELECT department_ids FROM provider_departments_data), ARRAY[]::uuid[]) as provider_department_ids,
    (SELECT model_usage_count FROM model_usage_data) as model_usage_count
FROM params x
CROSS JOIN user_profile up
CROSS JOIN user_departments ud
CROSS JOIN provider_group_data pgd;
$$;
