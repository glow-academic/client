-- Department Access Check (Query 1 of Two-Pass Architecture)
-- Returns user context and department state for Python to compute permissions
-- This query runs FIRST, before ID fetching

-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_get_department_access_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_department_access_v4(%s)', r.sig);
    END LOOP;
END $$;

-- Create function
CREATE OR REPLACE FUNCTION api_get_department_access_v4(
    profile_id uuid,
    department_id uuid DEFAULT NULL,
    draft_id uuid DEFAULT NULL
)
RETURNS TABLE (
    -- Basic metadata
    actor_name text,
    department_exists boolean,
    draft_version int,
    group_id uuid,

    -- User context for Python permission logic
    user_role text,
    user_department_ids uuid[],

    -- Department state for Python permission logic
    department_department_ids uuid[],
    usage_count bigint
)
LANGUAGE sql
STABLE
AS $$
WITH params AS (
    SELECT
        department_id AS department_id,
        profile_id AS profile_id,
        draft_id AS draft_id
),
-- Check if department exists
department_exists_check AS (
    SELECT
        CASE
            WHEN (SELECT department_id FROM params) IS NULL THEN NULL::boolean
            ELSE EXISTS(SELECT 1 FROM department_artifact WHERE id = (SELECT department_id FROM params))::boolean
        END as department_exists
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
-- Resolve canonical department group context (draft override handled in Python service layer)
department_group_data AS (
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
-- Get department's parent departments (for access check - departments don't have parent departments like personas)
department_departments_data AS (
    SELECT ARRAY[]::uuid[] as department_ids
),
-- Get department usage count (cohort/scenario/persona/simulation usage for permission logic)
department_usage_data AS (
    SELECT
        CASE
            WHEN (SELECT department_id FROM params) IS NULL THEN 0::bigint
            ELSE (
                (SELECT COUNT(*) FROM profile_departments_junction WHERE department_id = (SELECT department_id FROM params) AND active = true) +
                (SELECT COUNT(*) FROM simulation_departments_junction WHERE department_id = (SELECT department_id FROM params) AND active = true) +
                (SELECT COUNT(*) FROM scenario_departments_junction WHERE department_id = (SELECT department_id FROM params) AND active = true) +
                (SELECT COUNT(*) FROM persona_departments_junction WHERE department_id = (SELECT department_id FROM params) AND active = true) +
                (SELECT COUNT(*) FROM document_departments_junction WHERE department_id = (SELECT department_id FROM params) AND active = true) +
                (SELECT COUNT(*) FROM cohort_departments_junction WHERE department_id = (SELECT department_id FROM params) AND active = true)
            )::bigint
        END as usage_count
)
SELECT
    -- Basic metadata
    up.actor_name::text as actor_name,
    (SELECT department_exists FROM department_exists_check) as department_exists,
    (SELECT draft_version FROM draft_version_data) as draft_version,
    dgd.group_id,

    -- User context for Python permission logic
    up.role::text as user_role,
    ud.department_ids as user_department_ids,

    -- Department state for Python permission logic
    (SELECT department_ids FROM department_departments_data) as department_department_ids,
    (SELECT usage_count FROM department_usage_data) as usage_count
FROM params x
CROSS JOIN user_profile up
CROSS JOIN user_departments ud
CROSS JOIN department_group_data dgd;
$$;
