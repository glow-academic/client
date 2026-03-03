-- Setting Save Access Check
-- Returns setting department_ids for Python to compute save permissions
-- For update mode: returns setting_department_ids
-- For create mode: returns empty array (setting_id is NULL)

-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_check_setting_save_access_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_check_setting_save_access_v4(%s)', r.sig);
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION api_check_setting_save_access_v4(
    profile_id uuid,
    setting_id uuid DEFAULT NULL
)
RETURNS TABLE (
    setting_department_ids uuid[]
)
LANGUAGE sql
STABLE
AS $$
-- User context (actor_name, user_role, department_ids) comes from get_profile_context_internal() in Python
WITH params AS (
    SELECT
        profile_id AS profile_id,
        setting_id AS setting_id
),
setting_departments AS (
    SELECT COALESCE(
        ARRAY_AGG(ds.department_id ORDER BY ds.created_at) FILTER (WHERE ds.department_id IS NOT NULL),
        ARRAY[]::uuid[]
    ) as department_ids
    FROM params x
    LEFT JOIN department_settings_junction ds ON ds.settings_id = x.setting_id AND ds.active = true
    WHERE x.setting_id IS NOT NULL
)
SELECT
    COALESCE((SELECT department_ids FROM setting_departments), ARRAY[]::uuid[]) as setting_department_ids
FROM params x
$$;
