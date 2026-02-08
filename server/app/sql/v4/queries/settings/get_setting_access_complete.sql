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
    actor_name text,
    user_role text,
    user_department_ids uuid[],
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
user_profile AS (
    SELECT vupc.actor_name, vupc.role
    FROM view_user_profile_context vupc
    JOIN params p ON p.profile_id = vupc.profile_id
    LIMIT 1
),
user_departments AS (
    SELECT COALESCE(ARRAY_AGG(pd.department_id), ARRAY[]::uuid[]) AS department_ids
    FROM profile_departments_junction pd
    JOIN params p ON p.profile_id = pd.profile_id
    WHERE pd.active = true
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
            SELECT dde.group_id
            FROM draft_domains_entry dde
            JOIN params p ON p.draft_id = dde.draft_id
            WHERE dde.active = true
            LIMIT 1
        ),
        (SELECT id FROM view_groups_entry ORDER BY created_at DESC LIMIT 1)
    ) AS group_id
)
SELECT
    up.actor_name,
    up.role AS user_role,
    ud.department_ids AS user_department_ids,
    sd.department_ids AS setting_department_ids,
    sec.setting_exists,
    dd.draft_version,
    gd.group_id
FROM user_profile up
CROSS JOIN user_departments ud
CROSS JOIN setting_departments sd
CROSS JOIN setting_exists_check sec
LEFT JOIN draft_data dd ON true
CROSS JOIN group_data gd;
$$;
