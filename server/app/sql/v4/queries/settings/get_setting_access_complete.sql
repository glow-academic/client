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
    draft_id uuid DEFAULT NULL
)
RETURNS TABLE (
    setting_department_ids uuid[],
    setting_exists boolean,
    draft_version int,
    group_id uuid
)
LANGUAGE sql
STABLE
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
draft_data AS (
    SELECT d.version AS draft_version
    FROM view_drafts_entry d
    JOIN params p ON p.draft_id = d.id
    LIMIT 1
),
group_data AS (
    SELECT COALESCE(
        (
            SELECT d.group_id
            FROM view_drafts_entry d
            JOIN params p ON p.draft_id = d.id
            LIMIT 1
        ),
        (SELECT id FROM view_groups_entry ORDER BY created_at DESC LIMIT 1)
    ) AS group_id
)
SELECT
    sd.department_ids AS setting_department_ids,
    sec.setting_exists,
    dd.draft_version,
    gd.group_id
FROM user_profile up
CROSS JOIN setting_departments sd
CROSS JOIN setting_exists_check sec
LEFT JOIN draft_data dd ON true
CROSS JOIN group_data gd;
$$;

