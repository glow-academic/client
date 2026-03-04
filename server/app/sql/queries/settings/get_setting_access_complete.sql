-- Settings Access Query (Pass 1 of two-pass architecture)

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_get_setting_access_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_setting_access_v4(%s)', r.sig);
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION api_get_setting_access_v4(
    profile_id uuid,
    setting_id uuid DEFAULT NULL,
    draft_id uuid DEFAULT NULL,
    draft_group_id uuid DEFAULT NULL,
    draft_version int DEFAULT NULL
)
RETURNS TABLE (
    setting_department_ids uuid[],
    setting_exists boolean,
    effective_draft_version int,
    group_id uuid
)
LANGUAGE sql
VOLATILE
AS $$
WITH params AS (
    SELECT profile_id, setting_id, draft_id
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
setting_departments AS (
    SELECT
        CASE
            WHEN (SELECT setting_id FROM params) IS NULL THEN ARRAY[]::uuid[]
            ELSE COALESCE(
                (
                    SELECT ARRAY_AGG(ds.department_id)
                    FROM department_settings_junction ds
                    WHERE ds.settings_id = (SELECT setting_id FROM params)
                      AND ds.active = true
                ),
                ARRAY[]::uuid[]
            )
        END AS department_ids
),
setting_exists_check AS (
    SELECT
        CASE
            WHEN (SELECT setting_id FROM params) IS NULL THEN NULL::boolean
            ELSE EXISTS(
                SELECT 1
                FROM setting_artifact s
                WHERE s.id = (SELECT setting_id FROM params)
            )::boolean
        END AS setting_exists
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
)
SELECT
    sd.department_ids AS setting_department_ids,
    sec.setting_exists,
    draft_version as effective_draft_version,
    (SELECT group_id FROM effective_group) as group_id
FROM user_profile up
CROSS JOIN setting_departments sd
CROSS JOIN setting_exists_check sec;
$$;

