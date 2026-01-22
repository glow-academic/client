-- Get setting profiles for default-idp sync and theme mapping
-- Returns profiles linked to active settings, with department scope when applicable
-- Converted to PostgreSQL function
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'infra_get_setting_profiles_for_idp_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS infra_get_setting_profiles_for_idp_v4(%s)', r.sig);
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION infra_get_setting_profiles_for_idp_v4()
RETURNS TABLE (
    profile_id uuid,
    profile_name text,
    role profile_type,
    setting_id uuid,
    department_id uuid
)
LANGUAGE sql
STABLE
AS $$
    WITH active_settings AS (
        SELECT s.id
        FROM setting_artifact s
        WHERE EXISTS (
            SELECT 1
            FROM setting_flags_junction sf
            JOIN flags_resource f ON sf.flag_id = f.id
            WHERE sf.setting_id = s.id
              AND f.name = 'setting_active'
              AND sf.value = true
        )
    ),
    dept_settings AS (
        SELECT ds.department_id, ds.settings_id
        FROM department_settings_junction ds
        JOIN active_settings s ON s.id = ds.settings_id
        WHERE ds.active = true
    ),
    default_settings AS (
        SELECT s.id as settings_id
        FROM active_settings s
        WHERE NOT EXISTS (
            SELECT 1
            FROM department_settings_junction ds
            WHERE ds.settings_id = s.id
              AND ds.active = true
        )
    ),
    settings_profiles AS (
        SELECT sp.setting_id, sp.profile_id
        FROM setting_profiles_junction sp
        WHERE sp.active = true
    ),
    profile_details AS (
        SELECT
            pr.profile_id,
            COALESCE(
                (SELECT n.name
                 FROM profile_names_junction pn
                 JOIN names_resource n ON n.id = pn.name_id
                 WHERE pn.profile_id = pr.profile_id
                   AND pn.active = true
                 LIMIT 1),
                pr.profile_id::text
            ) as profile_name,
            COALESCE(
                (SELECT r.role
                 FROM profile_roles_junction prj
                 JOIN roles_resource r ON r.id = prj.role_id
                 WHERE prj.profile_id = pr.profile_id
                   AND prj.active = true
                 LIMIT 1),
                pr.role
            ) as role
        FROM profiles_resource pr
        WHERE pr.active = true
    )
    SELECT
        sp.profile_id,
        pd.profile_name,
        pd.role,
        sp.setting_id,
        ds.department_id
    FROM settings_profiles sp
    JOIN dept_settings ds ON ds.settings_id = sp.setting_id
    JOIN profile_details pd ON pd.profile_id = sp.profile_id
    UNION ALL
    SELECT
        sp.profile_id,
        pd.profile_name,
        pd.role,
        sp.setting_id,
        NULL::uuid as department_id
    FROM settings_profiles sp
    JOIN default_settings ds ON ds.settings_id = sp.setting_id
    JOIN profile_details pd ON pd.profile_id = sp.profile_id
$$;
