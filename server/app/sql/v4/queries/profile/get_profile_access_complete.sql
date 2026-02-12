-- Profile Access Check (Query 1 of Two-Pass Architecture)
-- Returns user context and profile state for Python to compute permissions
-- This query runs FIRST, before ID fetching

-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_get_profile_access_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_profile_access_v4(%s)', r.sig);
    END LOOP;
END $$;

-- Create function
CREATE OR REPLACE FUNCTION api_get_profile_access_v4(
    profile_id uuid,
    target_profile_id uuid DEFAULT NULL,
    draft_id uuid DEFAULT NULL
)
RETURNS TABLE (
    profile_exists boolean,
    draft_version int,
    group_id uuid,
    resolved_target_profile_id uuid,


    -- Target profile state for Python permission logic
    target_role text,
    target_department_ids uuid[],
    target_is_self boolean,

    -- Role options and role resources
    role_options text[],
    roles types.q_get_profile_v4_role_resource[]
)
LANGUAGE sql
STABLE
AS $$
WITH params AS (
    SELECT
        profile_id AS profile_id,
        target_profile_id AS target_profile_id,
        draft_id AS draft_id
),
-- Check if profile exists
profile_exists_check AS (
    SELECT
        CASE
            WHEN (SELECT target_profile_id FROM params) IS NULL THEN NULL::boolean
            ELSE EXISTS(SELECT 1 FROM profile_artifact WHERE id = (SELECT target_profile_id FROM params))::boolean
        END as profile_exists
),
-- Resolve target profile ID
resolve_target_profile_id AS (
    SELECT
        CASE
            WHEN (SELECT target_profile_id FROM params) IS NOT NULL
            THEN (SELECT target_profile_id FROM params)
            ELSE NULL::uuid
        END as resolved_target_profile_id
),
-- User context: actor_name comes from get_profile_context_internal() in Python
user_profile AS (
    SELECT COALESCE(r.role, 'member'::profile_type) as role,
           ''::text as actor_name
    FROM profile_roles_junction prj
    JOIN roles_resource r ON prj.role_id = r.id
    WHERE prj.profile_id = (SELECT profile_id FROM params)
    LIMIT 1
),
-- Get target profile role (from draft or junction)
target_role_data AS (
    SELECT
        COALESCE(
            (
                SELECT r.role::text
                FROM roles_drafts_connection dr
                JOIN roles_resource r ON dr.roles_id = r.id
                WHERE dr.draft_id = (SELECT draft_id FROM params)
                  AND dr.active = true
                LIMIT 1
            ),
            CASE
                WHEN (SELECT resolved_target_profile_id FROM resolve_target_profile_id) IS NULL THEN NULL::text
                ELSE (
                    SELECT r.role::text
                    FROM profile_roles_junction pr
                    JOIN roles_resource r ON pr.role_id = r.id
                    WHERE pr.profile_id = (SELECT resolved_target_profile_id FROM resolve_target_profile_id)
                      AND pr.active = true
                    LIMIT 1
                )
            END
        ) as role
    FROM params
    LIMIT 1
),
-- Get target profile departments
target_departments_data AS (
    SELECT COALESCE(
        ARRAY_AGG(pd.department_id ORDER BY pd.created_at) FILTER (WHERE pd.department_id IS NOT NULL),
        ARRAY[]::uuid[]
    ) as department_ids
    FROM params x
    LEFT JOIN profile_departments_junction pd ON pd.profile_id = (SELECT resolved_target_profile_id FROM resolve_target_profile_id) AND pd.active = true
    WHERE (SELECT resolved_target_profile_id FROM resolve_target_profile_id) IS NOT NULL
),
-- Get group_id from target profile or current profile
group_id_data AS (
    SELECT
        (SELECT d.group_id FROM view_drafts_entry d WHERE d.id = (SELECT draft_id FROM params)) as group_id
    FROM params
    LIMIT 1
),
-- Draft version
draft_version_data AS (
    SELECT d.version as draft_version
    FROM params x
    LEFT JOIN view_drafts_entry d ON d.id = x.draft_id
    WHERE TRUE
    LIMIT 1
),
-- Role options based on user role
role_options_data AS (
    SELECT
        CASE
            WHEN up.role = 'superadmin'::profile_type THEN
                ARRAY(
                    SELECT r.role::text
                    FROM roles_resource r
                    WHERE r.active = true
                      AND r.role IN ('superadmin'::profile_type, 'admin'::profile_type, 'instructional'::profile_type, 'member'::profile_type, 'guest'::profile_type, 'custom'::profile_type)
                    ORDER BY array_position(ARRAY['superadmin', 'admin', 'instructional', 'member', 'guest', 'custom']::text[], r.role::text)
                )
            WHEN up.role = 'admin'::profile_type THEN
                ARRAY(
                    SELECT r.role::text
                    FROM roles_resource r
                    WHERE r.active = true
                      AND r.role IN ('admin'::profile_type, 'instructional'::profile_type, 'member'::profile_type, 'guest'::profile_type, 'custom'::profile_type)
                    ORDER BY array_position(ARRAY['admin', 'instructional', 'member', 'guest', 'custom']::text[], r.role::text)
                )
            ELSE
                ARRAY(
                    SELECT r.role::text
                    FROM roles_resource r
                    WHERE r.active = true
                      AND r.role IN ('instructional'::profile_type, 'member'::profile_type, 'guest'::profile_type)
                    ORDER BY array_position(ARRAY['instructional', 'member', 'guest']::text[], r.role::text)
                )
        END as role_options
    FROM user_profile up
    LIMIT 1
),
-- Roles data (all active roles with metadata)
roles_data AS (
    SELECT
        COALESCE(
            ARRAY_AGG(
                (r.role::text, r.name, r.description, i.value, c.hex_code)::types.q_get_profile_v4_role_resource
                ORDER BY r.name
            ),
            '{}'::types.q_get_profile_v4_role_resource[]
        ) as roles
    FROM roles_resource r
    LEFT JOIN icons_resource i ON i.id = r.icon_id
    LEFT JOIN colors_resource c ON c.id = r.color_id
    WHERE r.active = true
)
SELECT
    -- Basic metadata
    (SELECT profile_exists FROM profile_exists_check) as profile_exists,
    (SELECT draft_version FROM draft_version_data) as draft_version,
    gid.group_id,
    (SELECT resolved_target_profile_id FROM resolve_target_profile_id) as resolved_target_profile_id,

    -- User context for Python permission logic

    -- Target profile state for Python permission logic
    (SELECT role FROM target_role_data) as target_role,
    COALESCE((SELECT department_ids FROM target_departments_data), ARRAY[]::uuid[]) as target_department_ids,
    ((SELECT profile_id FROM params) = (SELECT resolved_target_profile_id FROM resolve_target_profile_id)) as target_is_self,

    -- Role options and role resources
    COALESCE((SELECT role_options FROM role_options_data), ARRAY[]::text[]) as role_options,
    COALESCE((SELECT roles FROM roles_data), '{}'::types.q_get_profile_v4_role_resource[]) as roles
FROM params x
CROSS JOIN user_profile up
CROSS JOIN group_id_data gid;
$$;

