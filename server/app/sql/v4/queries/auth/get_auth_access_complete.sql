-- Auth Access Check (Query 1 of Two-Pass Architecture)
-- Returns user context and auth state for Python to compute permissions
-- This query runs FIRST, before ID fetching

-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_get_auth_access_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_auth_access_v4(%s)', r.sig);
    END LOOP;
END $$;

-- Create function
CREATE OR REPLACE FUNCTION api_get_auth_access_v4(
    profile_id uuid,
    auth_id uuid DEFAULT NULL,
    draft_id uuid DEFAULT NULL
)
RETURNS TABLE (
    -- Basic metadata
    actor_name text,
    auth_exists boolean,
    draft_version int,
    group_id uuid,

    -- User context for Python permission logic
    user_role text,
    user_department_ids uuid[]
)
LANGUAGE sql
STABLE
AS $$
WITH params AS (
    SELECT
        auth_id AS auth_id,
        profile_id AS profile_id,
        draft_id AS draft_id
),
-- Convert auths_resource.id to auth_artifact.id
auth_artifact_id_lookup AS (
    SELECT
        CASE
            WHEN (SELECT auth_id FROM params) IS NULL THEN NULL::uuid
            ELSE COALESCE(
                (SELECT aaj.auth_id FROM auths_resource ar JOIN auth_auths_junction aaj ON aaj.auths_id = ar.id WHERE ar.id = (SELECT auth_id FROM params)),
                (SELECT auth_id FROM params)
            )
        END as auth_artifact_id
),
-- Check if auth exists
auth_exists_check AS (
    SELECT
        CASE
            WHEN (SELECT auth_id FROM params) IS NULL THEN NULL::boolean
            ELSE EXISTS(SELECT 1 FROM auths_resource WHERE id = (SELECT auth_id FROM params))::boolean
        END as auth_exists
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
-- Resolve group context (draft override handled in Python service layer)
auth_group_data AS (
    SELECT
        COALESCE(
            (
                SELECT d.group_id
                FROM view_drafts_entry d
                WHERE d.id = (SELECT draft_id FROM params)
                LIMIT 1
            ),
            (
                SELECT id FROM view_groups_entry ORDER BY created_at DESC LIMIT 1
            )
        ) as group_id
),
-- Draft version is resolved in Python via internal draft fetch layer
draft_version_data AS (
    SELECT NULL::int as draft_version
)
SELECT
    -- Basic metadata
    up.actor_name::text as actor_name,
    (SELECT auth_exists FROM auth_exists_check) as auth_exists,
    (SELECT draft_version FROM draft_version_data) as draft_version,
    agd.group_id,

    -- User context for Python permission logic
    up.role::text as user_role,
    ud.department_ids as user_department_ids
FROM params x
CROSS JOIN user_profile up
CROSS JOIN user_departments ud
CROSS JOIN auth_group_data agd;
$$;
