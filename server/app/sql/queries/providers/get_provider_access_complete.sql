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
    draft_id uuid DEFAULT NULL,
    draft_group_id uuid DEFAULT NULL,
    draft_version int DEFAULT NULL
)
RETURNS TABLE (
    provider_exists boolean,
    effective_draft_version int,
    group_id uuid,


    -- Provider state for Python permission logic
    provider_department_ids uuid[],
    model_usage_count int
)
LANGUAGE sql
VOLATILE
AS $$
-- User context (actor_name, user_role, department_ids) comes from get_profile_context_internal() in Python
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
    (SELECT provider_exists FROM provider_exists_check) as provider_exists,
    draft_version as effective_draft_version,
    (SELECT group_id FROM effective_group) as group_id,

    -- User context for Python permission logic

    -- Provider state for Python permission logic
    COALESCE((SELECT department_ids FROM provider_departments_data), ARRAY[]::uuid[]) as provider_department_ids,
    (SELECT model_usage_count FROM model_usage_data) as model_usage_count
FROM params x;
$$;

