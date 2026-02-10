-- Field Access Check (Query 1 of Two-Pass Architecture)
-- Returns user context and field state for Python to compute permissions
-- This query runs FIRST, before ID fetching

-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_get_field_access_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_field_access_v4(%s)', r.sig);
    END LOOP;
END $$;

-- Create function
CREATE OR REPLACE FUNCTION api_get_field_access_v4(
    profile_id uuid,
    field_id uuid DEFAULT NULL,
    draft_id uuid DEFAULT NULL
)
RETURNS TABLE (
    -- Basic metadata
    actor_name text,
    field_exists boolean,
    draft_version int,
    group_id uuid,

    -- User context for Python permission logic
    user_role text,
    user_department_ids uuid[],

    -- Field state for Python permission logic
    field_department_ids uuid[]
)
LANGUAGE sql
STABLE
AS $$
WITH params AS (
    SELECT
        field_id AS field_id,
        profile_id AS profile_id,
        draft_id AS draft_id
),
-- Check if field exists
field_exists_check AS (
    SELECT
        CASE
            WHEN (SELECT field_id FROM params) IS NULL THEN NULL::boolean
            ELSE EXISTS(SELECT 1 FROM field_artifact WHERE id = (SELECT field_id FROM params))::boolean
        END as field_exists
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
-- Resolve canonical field group context (draft override handled in Python service layer)
field_group_data AS (
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
-- Get field departments (for access check)
field_departments_data AS (
    SELECT COALESCE(
        ARRAY_AGG(fd.department_id ORDER BY fd.created_at) FILTER (WHERE fd.department_id IS NOT NULL),
        ARRAY[]::uuid[]
    ) as department_ids
    FROM params x
    LEFT JOIN field_departments_junction fd ON fd.field_id = x.field_id AND fd.active = true
    WHERE x.field_id IS NOT NULL
)
SELECT
    -- Basic metadata
    up.actor_name::text as actor_name,
    (SELECT field_exists FROM field_exists_check) as field_exists,
    (SELECT draft_version FROM draft_version_data) as draft_version,
    fgd.group_id,

    -- User context for Python permission logic
    up.role::text as user_role,
    ud.department_ids as user_department_ids,

    -- Field state for Python permission logic
    COALESCE((SELECT department_ids FROM field_departments_data), ARRAY[]::uuid[]) as field_department_ids
FROM params x
CROSS JOIN user_profile up
CROSS JOIN user_departments ud
CROSS JOIN field_group_data fgd;
$$;
