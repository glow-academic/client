-- Get complete login data: providers and departments
-- Converted to function with composite types
-- Uses safe drop/recreate pattern: drop function first, then types (no CASCADE), then recreate
-- 1) Drop function first (breaks dependency on types)
-- Drop all versions of the function using DO block to handle signature variations
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'api_get_login_data_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_login_data_v4(%s)', r.sig);
    END LOOP;
END $$;

-- 2) Drop types WITHOUT CASCADE
-- Drop all types matching prefix pattern to handle type additions/removals
-- If any other object depends on them, this will ERROR and stop the migration (good)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT typname 
        FROM pg_type 
        WHERE typname LIKE 'q_get_login_data_v4_%'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I', r.typname);
    END LOOP;
END $$;

-- 3) Recreate types
CREATE TYPE types.q_get_login_data_v4_provider AS (
    id text,
    name text,
    icon text,
    is_default boolean
);

CREATE TYPE types.q_get_login_data_v4_department AS (
    id text,
    title text,
    description text
);

-- 4) Recreate function
CREATE OR REPLACE FUNCTION api_get_login_data_v4(department_id uuid DEFAULT NULL)
RETURNS TABLE (
    providers types.q_get_login_data_v4_provider[],
    departments types.q_get_login_data_v4_department[],
    guest_login_enabled boolean,
    show_default_account boolean,
    default_department_id text,
    realm_name text
)
LANGUAGE sql
STABLE
AS $$
WITH params AS (
    SELECT department_id AS department_id
),
-- Get default department from settings_default_department table
default_department_from_settings AS (
    SELECT sdd.department_id
    FROM settings s
    JOIN settings_default_department sdd ON sdd.settings_id = s.id
    WHERE EXISTS (SELECT 1 FROM scenario_flags sf JOIN flags fl ON sf.flag_id = fl.id WHERE sf.scenario_id = s.id AND fl.name = 'active' AND sf.type = 'active'::type_scenario_flags AND sf.value = true) AND sdd.active = true
    LIMIT 1
),
-- Get settings for the department (if department_id provided)
-- Note: Include department-specific settings even if inactive (they're linked via department_settings)
dept_settings AS (
    SELECT DISTINCT s.id as settings_id, EXISTS (SELECT 1 FROM setting_flags sf JOIN flags fl ON sf.flag_id = fl.id WHERE sf.setting_id = s.id AND fl.name = 'guest_login_enabled' AND sf.type = 'guest_login_enabled'::type_setting_flags AND sf.value = TRUE) as guest_login_enabled
    FROM settings s
    JOIN department_settings ds ON ds.settings_id = s.id
    WHERE ds.active = true
      AND ((SELECT department_id FROM params) IS NULL OR ds.department_id = (SELECT department_id FROM params))
),
-- Get default settings (no department links)
default_settings AS (
    SELECT s.id as settings_id, EXISTS (SELECT 1 FROM setting_flags sf JOIN flags fl ON sf.flag_id = fl.id WHERE sf.setting_id = s.id AND fl.name = 'guest_login_enabled' AND sf.type = 'guest_login_enabled'::type_setting_flags AND sf.value = TRUE) as guest_login_enabled
    FROM settings s
    WHERE EXISTS (SELECT 1 FROM scenario_flags sf JOIN flags fl ON sf.flag_id = fl.id WHERE sf.scenario_id = s.id AND fl.name = 'active' AND sf.type = 'active'::type_scenario_flags AND sf.value = true)
      AND NOT EXISTS (
          SELECT 1 FROM department_settings ds 
          WHERE ds.settings_id = s.id AND ds.active = true
      )
    LIMIT 1
),
-- Get guest_login_enabled from department-specific settings if department_id provided, otherwise from default settings
active_settings AS (
    SELECT COALESCE(
        CASE 
            WHEN (SELECT department_id FROM params) IS NOT NULL THEN (SELECT guest_login_enabled FROM dept_settings LIMIT 1)
            ELSE NULL
        END,
        (SELECT guest_login_enabled FROM default_settings LIMIT 1),
        true
    ) as guest_login_enabled
),
-- Get auths linked to department settings or default settings
dept_auths AS (
    SELECT DISTINCT a.id
    FROM auth a
    JOIN setting_auths sa ON sa.auth_id = a.id AND sa.active = true
    JOIN dept_settings ds ON ds.settings_id = sa.settings_id
    WHERE EXISTS (SELECT 1 FROM auth_flags af JOIN flags fl ON af.flag_id = fl.id WHERE af.auth_id = a.id AND fl.name = 'active' AND af.type = 'active'::type_auth_flags AND af.value = true)
),
-- Get auths linked to default settings
default_auths AS (
    SELECT DISTINCT a.id
    FROM auth a
    JOIN setting_auths sa ON sa.auth_id = a.id AND sa.active = true
    JOIN default_settings ds ON ds.settings_id = sa.settings_id
    WHERE EXISTS (SELECT 1 FROM auth_flags af JOIN flags fl ON af.flag_id = fl.id WHERE af.auth_id = a.id AND fl.name = 'active' AND af.type = 'active'::type_auth_flags AND af.value = true)
),
-- Providers query (always returns at least one row)
providers_data AS (
    SELECT 
        COALESCE(
            ARRAY_AGG(
                ((SELECT s.value FROM auth_slugs as_j JOIN slugs s ON s.id = as_j.slug_id WHERE as_j.auth_id = a.id LIMIT 1)::text, (SELECT n.name FROM auth_names an JOIN names n ON an.name_id = n.id WHERE an.auth_id = a.id LIMIT 1)::text, ''::text, EXISTS (SELECT 1 FROM default_auths da WHERE da.id = a.id))::types.q_get_login_data_v4_provider
                ORDER BY (SELECT n.name FROM auth_names an JOIN names n ON an.name_id = n.id WHERE an.auth_id = a.id LIMIT 1)
            ),
            '{}'::types.q_get_login_data_v4_provider[]
        ) as providers
    FROM auth a
    CROSS JOIN (SELECT guest_login_enabled FROM active_settings LIMIT 1) s
    WHERE EXISTS (SELECT 1 FROM auth_flags af JOIN flags fl ON af.flag_id = fl.id WHERE af.auth_id = a.id AND fl.name = 'active' AND af.type = 'active'::type_auth_flags AND af.value = true)
      AND (
          -- Include if department_id not provided (show all auths from all settings)
          (SELECT department_id FROM params) IS NULL
          -- OR if department_id is provided, ONLY include department-specific auths (exclude default ones)
          OR (
              (SELECT department_id FROM params) IS NOT NULL
              AND EXISTS (SELECT 1 FROM dept_auths da WHERE da.id = a.id)
          )
      )
),
-- Ensure providers_data always returns a row
providers_with_default AS (
    SELECT providers FROM providers_data
    UNION ALL
    SELECT '{}'::types.q_get_login_data_v4_provider[] WHERE NOT EXISTS (SELECT 1 FROM providers_data)
),
-- Departments query (always returns at least one row)
-- Order: default department first, then alphabetical by title
departments_data AS (
    SELECT 
        COALESCE(
            ARRAY_AGG(
                (d.id::text, (SELECT n.name FROM department_names dn JOIN names n ON dn.name_id = n.id WHERE dn.department_id = d.id LIMIT 1)::text, COALESCE((SELECT d2.description FROM department_descriptions dd JOIN descriptions d2 ON dd.description_id = d2.id WHERE dd.department_id = d.id LIMIT 1), '')::text)::types.q_get_login_data_v4_department
                ORDER BY 
                    -- Default department first (NULLS LAST means non-defaults come after)
                    CASE WHEN d.id = (SELECT department_id FROM default_department_from_settings LIMIT 1) 
                         THEN 0 ELSE 1 END,
                    -- Then alphabetical by title
                    (SELECT n.name FROM department_names dn JOIN names n ON dn.name_id = n.id WHERE dn.department_id = d.id LIMIT 1)
            ),
            '{}'::types.q_get_login_data_v4_department[]
        ) as departments
    FROM departments d
    WHERE EXISTS (SELECT 1 FROM department_flags df JOIN flags fl ON df.flag_id = fl.id WHERE df.department_id = d.id AND fl.name = 'active' AND df.type = 'active'::type_department_flags AND df.value = true)
),
-- Ensure departments_data always returns a row
departments_with_default AS (
    SELECT departments FROM departments_data
    UNION ALL
    SELECT '{}'::types.q_get_login_data_v4_department[] WHERE NOT EXISTS (SELECT 1 FROM departments_data)
),
-- Calculate realm name: use settings_id if dept settings has keys, else 'master'
-- Simplified: Check if dept settings has keys, if yes use settings_id, else 'master'
realm_name_calc AS (
    SELECT 
        CASE 
            -- No department → master realm
            WHEN (SELECT department_id FROM params) IS NULL THEN 'master'::text
            -- Check if department-specific settings has keys
            WHEN EXISTS (
                SELECT 1 
                FROM department_settings ds
                JOIN settings s ON s.id = ds.settings_id AND EXISTS (SELECT 1 FROM scenario_flags sf JOIN flags fl ON sf.flag_id = fl.id WHERE sf.scenario_id = s.id AND fl.name = 'active' AND sf.type = 'active'::type_scenario_flags AND sf.value = true)
                JOIN setting_auth_keys sak ON sak.settings_id = s.id AND sak.active = true
                WHERE ds.department_id = (SELECT department_id FROM params) AND ds.active = true
            ) THEN (
                -- Department settings has keys → use settings_id as realm
                SELECT s.id::text
                FROM department_settings ds
                JOIN settings s ON s.id = ds.settings_id AND EXISTS (SELECT 1 FROM scenario_flags sf JOIN flags fl ON sf.flag_id = fl.id WHERE sf.scenario_id = s.id AND fl.name = 'active' AND sf.type = 'active'::type_scenario_flags AND sf.value = true)
                WHERE ds.department_id = (SELECT department_id FROM params) AND ds.active = true
                LIMIT 1
            )
            -- No keys in dept settings → use master realm
            ELSE 'master'::text
        END as realm_name
),
-- Check department-specific default account (if department_id provided)
dept_default_account_check AS (
    SELECT EXISTS (
        SELECT 1
        FROM settings s
        JOIN department_settings ds ON ds.settings_id = s.id AND ds.active = true
        JOIN settings_default_account sda ON sda.settings_id = s.id AND sda.active = true
        WHERE ds.department_id = (SELECT department_id FROM params)
          AND EXISTS (SELECT 1 FROM scenario_flags sf JOIN flags fl ON sf.flag_id = fl.id WHERE sf.scenario_id = s.id AND fl.name = 'active' AND sf.type = 'active'::type_scenario_flags AND sf.value = true)
          AND (SELECT department_id FROM params) IS NOT NULL
    )::boolean as dept_has_default_account
),
-- Check default settings default account (fallback)
default_settings_default_account_check AS (
    SELECT EXISTS (
        SELECT 1
        FROM settings s
        JOIN settings_default_account sda ON sda.settings_id = s.id AND sda.active = true
        WHERE EXISTS (SELECT 1 FROM scenario_flags sf JOIN flags fl ON sf.flag_id = fl.id WHERE sf.scenario_id = s.id AND fl.name = 'active' AND sf.type = 'active'::type_scenario_flags AND sf.value = true)
          AND NOT EXISTS (
              SELECT 1 FROM department_settings ds 
              WHERE ds.settings_id = s.id AND ds.active = true
          )
    )::boolean as default_settings_has_default_account
),
-- Calculate show_default_account: show if no providers AND default account exists
show_default_account_calc AS (
    SELECT 
        CASE 
            -- No providers exist
            WHEN array_length((SELECT providers FROM providers_with_default LIMIT 1), 1) IS NULL OR array_length((SELECT providers FROM providers_with_default LIMIT 1), 1) = 0 THEN
                CASE 
                    -- Department-specific: check department settings first, fallback to default settings
                    WHEN (SELECT department_id FROM params) IS NOT NULL THEN
                        COALESCE(
                            (SELECT dept_has_default_account FROM dept_default_account_check),
                            (SELECT default_settings_has_default_account FROM default_settings_default_account_check),
                            false
                        )
                    -- No department: check default settings only
                    ELSE
                        COALESCE(
                            (SELECT default_settings_has_default_account FROM default_settings_default_account_check),
                            false
                        )
                END
            -- Providers exist → don't show default account
            ELSE false
        END::boolean as show_default_account
)
-- Cross join ensures we always get exactly one row
SELECT 
    p.providers as providers,
    d.departments as departments,
    COALESCE((SELECT guest_login_enabled FROM active_settings LIMIT 1), true)::boolean as guest_login_enabled,
    COALESCE((SELECT show_default_account FROM show_default_account_calc LIMIT 1), false)::boolean as show_default_account,
    COALESCE((SELECT department_id::text FROM default_department_from_settings LIMIT 1), NULL)::text as default_department_id,
    (SELECT realm_name FROM realm_name_calc LIMIT 1)::text as realm_name
FROM providers_with_default p
CROSS JOIN departments_with_default d
CROSS JOIN realm_name_calc
CROSS JOIN show_default_account_calc
LIMIT 1
$$;