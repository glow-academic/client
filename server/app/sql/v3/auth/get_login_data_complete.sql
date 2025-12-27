-- Get complete login data: providers and departments
-- Converted to function with composite types
-- Uses safe drop/recreate pattern: drop function first, then types (no CASCADE), then recreate

BEGIN;

-- 1) Drop function first (breaks dependency on types)
-- Drop all versions of the function using DO block to handle signature variations
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'api_get_login_data_v3'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_login_data_v3(%s)', r.sig);
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
        WHERE typname LIKE 'q_get_login_data_v3_%'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I', r.typname);
    END LOOP;
END $$;

-- 3) Recreate types
CREATE TYPE types.q_get_login_data_v3_provider AS (
    id text,
    name text,
    icon text,
    is_default boolean
);

CREATE TYPE types.q_get_login_data_v3_department AS (
    id text,
    title text,
    description text
);

-- 4) Recreate function
CREATE OR REPLACE FUNCTION api_get_login_data_v3(department_id uuid DEFAULT NULL)
RETURNS TABLE (
    providers types.q_get_login_data_v3_provider[],
    departments types.q_get_login_data_v3_department[],
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
    WHERE s.active = true AND sdd.active = true
    LIMIT 1
),
-- Get settings for the department (if department_id provided)
-- Note: Include department-specific settings even if inactive (they're linked via department_settings)
dept_settings AS (
    SELECT DISTINCT s.id as settings_id, s.guest_login_enabled
    FROM settings s
    JOIN department_settings ds ON ds.settings_id = s.id
    WHERE ds.active = true
      AND ((SELECT department_id FROM params) IS NULL OR ds.department_id = (SELECT department_id FROM params))
),
-- Get default settings (no department links)
default_settings AS (
    SELECT s.id as settings_id, s.guest_login_enabled
    FROM settings s
    WHERE s.active = true
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
    WHERE a.active = true
),
-- Get auths linked to default settings
default_auths AS (
    SELECT DISTINCT a.id
    FROM auth a
    JOIN setting_auths sa ON sa.auth_id = a.id AND sa.active = true
    JOIN default_settings ds ON ds.settings_id = sa.settings_id
    WHERE a.active = true
),
-- Providers query (always returns at least one row)
providers_data AS (
    SELECT 
        COALESCE(
            ARRAY_AGG(
                (a.slug::text, a.name::text, COALESCE(a.icon_url, '')::text, EXISTS (SELECT 1 FROM default_auths da WHERE da.id = a.id))::types.q_get_login_data_v3_provider
                ORDER BY a.name
            ),
            '{}'::types.q_get_login_data_v3_provider[]
        ) as providers
    FROM auth a
    CROSS JOIN (SELECT guest_login_enabled FROM active_settings LIMIT 1) s
    WHERE a.active = true
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
    SELECT '{}'::types.q_get_login_data_v3_provider[] WHERE NOT EXISTS (SELECT 1 FROM providers_data)
),
-- Departments query (always returns at least one row)
-- Order: default department first, then alphabetical by title
departments_data AS (
    SELECT 
        COALESCE(
            ARRAY_AGG(
                (id::text, title::text, description::text)::types.q_get_login_data_v3_department
                ORDER BY 
                    -- Default department first (NULLS LAST means non-defaults come after)
                    CASE WHEN id = (SELECT department_id FROM default_department_from_settings LIMIT 1) 
                         THEN 0 ELSE 1 END,
                    -- Then alphabetical by title
                    title
            ),
            '{}'::types.q_get_login_data_v3_department[]
        ) as departments
    FROM departments 
    WHERE active = true
),
-- Ensure departments_data always returns a row
departments_with_default AS (
    SELECT departments FROM departments_data
    UNION ALL
    SELECT '{}'::types.q_get_login_data_v3_department[] WHERE NOT EXISTS (SELECT 1 FROM departments_data)
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
                JOIN settings s ON s.id = ds.settings_id AND s.active = true
                JOIN setting_auth_keys sak ON sak.settings_id = s.id AND sak.active = true
                WHERE ds.department_id = (SELECT department_id FROM params) AND ds.active = true
            ) THEN (
                -- Department settings has keys → use settings_id as realm
                SELECT s.id::text
                FROM department_settings ds
                JOIN settings s ON s.id = ds.settings_id AND s.active = true
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
          AND s.active = true
          AND (SELECT department_id FROM params) IS NOT NULL
    )::boolean as dept_has_default_account
),
-- Check default settings default account (fallback)
default_settings_default_account_check AS (
    SELECT EXISTS (
        SELECT 1
        FROM settings s
        JOIN settings_default_account sda ON sda.settings_id = s.id AND sda.active = true
        WHERE s.active = true
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

COMMIT;
