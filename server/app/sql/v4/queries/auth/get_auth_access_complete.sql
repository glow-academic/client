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
    auth_exists boolean,
    draft_version int,
    group_id uuid

)
LANGUAGE sql
STABLE
AS $$
-- User context (actor_name, user_role, department_ids) comes from get_profile_context_internal() in Python
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
-- Resolve group context (draft override handled in Python service layer)
auth_group_data AS (
    SELECT NULL::uuid as group_id
),
-- Draft version is resolved in Python via internal draft fetch layer
draft_version_data AS (
    SELECT NULL::int as draft_version
)
SELECT
    -- Basic metadata
    (SELECT auth_exists FROM auth_exists_check) as auth_exists,
    (SELECT draft_version FROM draft_version_data) as draft_version,
    agd.group_id
FROM params x
CROSS JOIN auth_group_data agd;
$$;

