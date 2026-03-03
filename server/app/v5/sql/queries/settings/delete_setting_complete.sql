-- Delete setting with validation and actor context
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_delete_setting_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_delete_setting_v4(%s)', r.sig);
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION api_delete_setting_v4(
    setting_id uuid,
    profile_id uuid
)
RETURNS TABLE (
    setting_exists boolean,
    setting_id uuid,
    name text,
    deleted boolean
)
LANGUAGE sql
VOLATILE
AS $$
-- User context (actor_name, user_role, department_ids) comes from get_profile_context_internal() in Python
WITH params AS (
    SELECT
        setting_id AS setting_id,
        profile_id AS profile_id
),
setting_exists_check AS (
    SELECT EXISTS(
        SELECT 1
        FROM setting_artifact s
        WHERE s.id = (SELECT setting_id FROM params)
    )::boolean AS setting_exists
),
setting_data AS (
    SELECT
        s.id AS setting_id,
        COALESCE(
            (
                SELECT n.name
                FROM setting_names_junction sn
                JOIN names_resource n ON n.id = sn.name_id
                WHERE sn.setting_id = s.id
                ORDER BY sn.created_at DESC
                LIMIT 1
            ),
            ''
        ) AS name
    FROM setting_artifact s
    WHERE s.id = (SELECT setting_id FROM params)
),
setting_delete AS (
    DELETE FROM setting_artifact
    WHERE id = (SELECT setting_id FROM params)
      AND EXISTS (SELECT 1 FROM setting_data)
    RETURNING id
)
SELECT
    sec.setting_exists,
    sd.setting_id,
    sd.name,
    (sdel.id IS NOT NULL) AS deleted
FROM setting_exists_check sec
LEFT JOIN setting_data sd ON sec.setting_exists = true
LEFT JOIN setting_delete sdel ON sdel.id = sd.setting_id
LIMIT 1
$$;

