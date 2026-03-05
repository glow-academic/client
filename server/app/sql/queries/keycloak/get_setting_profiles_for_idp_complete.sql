-- Get setting profiles for default-idp sync and theme mapping
-- Returns profiles linked to active settings, with department scope when applicable
-- Resource-first: departments_resource.setting_ids -> setting_settings_junction -> setting_profiles_junction
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
    WITH dept_settings AS (
        -- Department settings via resource-first: departments_resource.setting_ids -> settings_resource -> setting_settings_junction
        SELECT
            ddj.department_id,
            ssj.setting_id as artifacts_id
        FROM departments_resource dr
        JOIN department_departments_junction ddj ON ddj.department_id = dr.id
        CROSS JOIN LATERAL UNNEST(dr.setting_ids) AS s_id
        JOIN settings_resource sr ON sr.id = s_id AND sr.active = true
        JOIN setting_settings_junction ssj ON ssj.settings_id = s_id
        WHERE dr.active = true
    ),
    default_settings AS (
        -- Default settings: active setting artifacts not linked to any department
        SELECT ssj.setting_id as artifacts_id
        FROM settings_resource sr
        JOIN setting_settings_junction ssj ON ssj.settings_id = sr.id
        WHERE sr.active = true
          AND NOT EXISTS (
              SELECT 1 FROM departments_resource dr
              WHERE sr.id = ANY(dr.setting_ids)
          )
    ),
    settings_profiles AS (
        SELECT sp.setting_id, sp.profile_id
        FROM setting_profiles_junction sp
        WHERE sp.active = true
    ),
    profile_details AS (
        SELECT
            ppj.profile_id as profile_id,
            COALESCE(
                (SELECT n.name
                 FROM profile_names_junction pn
                 JOIN names_resource n ON n.id = pn.names_id
                 WHERE pn.profile_id = ppj.profile_id
                   AND pn.active = true
                 LIMIT 1),
                ppj.profile_id::text
            ) as profile_name,
            COALESCE(
                (SELECT r.role
                 FROM profile_roles_junction prj
                 JOIN roles_resource r ON r.id = prj.role_id
                 WHERE prj.profile_id = ppj.profile_id
                   AND prj.active = true
                 LIMIT 1),
                pr.role
            ) as role
        FROM profiles_resource pr
        JOIN profile_profiles_junction ppj ON ppj.profile_id = pr.id
        WHERE pr.active = true
    )
    -- Department-scoped profiles
    SELECT
        sp.profile_id,
        pd.profile_name,
        pd.role,
        sp.setting_id,
        ds.department_id
    FROM settings_profiles sp
    JOIN dept_settings ds ON ds.artifacts_id = sp.setting_id
    JOIN profile_details pd ON pd.profile_id = sp.profile_id
    UNION ALL
    -- Default (non-department) profiles
    SELECT
        sp.profile_id,
        pd.profile_name,
        pd.role,
        sp.setting_id,
        NULL::uuid as department_id
    FROM settings_profiles sp
    JOIN default_settings ds ON ds.artifacts_id = sp.setting_id
    JOIN profile_details pd ON pd.profile_id = sp.profile_id
$$;
