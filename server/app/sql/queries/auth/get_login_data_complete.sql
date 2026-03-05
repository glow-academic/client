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

CREATE TYPE types.q_get_login_data_v4_organization AS (
    id text,
    alias text
);

-- 4) Recreate function
CREATE OR REPLACE FUNCTION api_get_login_data_v4(department_id uuid DEFAULT NULL)
RETURNS TABLE (
    providers types.q_get_login_data_v4_provider[],
    departments types.q_get_login_data_v4_department[],
    guest_login_enabled boolean,
    default_department_id text,
    realm_name text,
    organization_id text
)
LANGUAGE sql
STABLE
AS $$
WITH params AS (
    SELECT department_id AS department_id
),
-- Get settings for the department (if department_id provided)
-- Note: Include department-specific settings even if inactive (they're linked via department_settings_junction)
dept_settings AS (
    SELECT DISTINCT s.id as settings_id, EXISTS (SELECT 1 FROM setting_flags_junction sf JOIN flags_resource f ON sf.flag_id = f.id WHERE sf.setting_id = s.id AND f.name = 'guest_login_enabled' AND f.value = TRUE) as guest_login_enabled
    FROM setting_artifact s
    JOIN department_settings_junction ds ON ds.settings_id = s.id
    WHERE ds.active = true
      AND ((SELECT department_id FROM params) IS NULL OR ds.department_id = (SELECT department_id FROM params))
),
-- Get default settings (no department links)
default_settings AS (
    SELECT s.id as settings_id, EXISTS (SELECT 1 FROM setting_flags_junction sf JOIN flags_resource f ON sf.flag_id = f.id WHERE sf.setting_id = s.id AND f.name = 'guest_login_enabled' AND f.value = TRUE) as guest_login_enabled
    FROM setting_artifact s
    WHERE EXISTS (SELECT 1 FROM scenario_flags_junction sf JOIN flags_resource f ON sf.flag_id = f.id WHERE sf.scenario_id = s.id AND f.type = 'scenario_active' AND f.value = true)
      AND NOT EXISTS (
          SELECT 1 FROM department_settings_junction ds
          WHERE ds.settings_id = s.id AND ds.active = true
      )
    LIMIT 1
),
-- Get guest_login_enabled FROM department_artifact-specific settings if department_id provided, otherwise from default settings
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
    FROM auths_resource a
    JOIN setting_auths_junction sa ON sa.auth_id = a.id AND sa.active = true
    JOIN dept_settings ds ON ds.settings_id = sa.settings_id
    WHERE EXISTS (SELECT 1 FROM auth_flags_junction af JOIN flags_resource f ON af.flag_id = f.id WHERE af.auth_id = a.id AND f.name = 'auth_active' AND f.value = true)
),
-- Get auths linked to default settings
default_auths AS (
    SELECT DISTINCT a.id
    FROM auths_resource a
    JOIN setting_auths_junction sa ON sa.auth_id = a.id AND sa.active = true
    JOIN default_settings ds ON ds.settings_id = sa.settings_id
    WHERE EXISTS (SELECT 1 FROM auth_flags_junction af JOIN flags_resource f ON af.flag_id = f.id WHERE af.auth_id = a.id AND f.name = 'auth_active' AND f.value = true)
),
-- Providers query (always returns at least one row)
providers_data AS (
    SELECT
        COALESCE(
            ARRAY_AGG(
                ((SELECT s.value FROM auth_slugs_junction as_j JOIN slugs_resource s ON s.id = as_j.slugs_id WHERE as_j.auth_id = a.id LIMIT 1)::text, (SELECT n.name FROM auth_names_junction an JOIN names_resource n ON an.names_id = n.id WHERE an.auth_id = a.id LIMIT 1)::text, ''::text, EXISTS (SELECT 1 FROM default_auths da WHERE da.id = a.id))::types.q_get_login_data_v4_provider
                ORDER BY (SELECT n.name FROM auth_names_junction an JOIN names_resource n ON an.names_id = n.id WHERE an.auth_id = a.id LIMIT 1)
            ),
            '{}'::types.q_get_login_data_v4_provider[]
        ) as providers
    FROM auths_resource a
    CROSS JOIN (SELECT guest_login_enabled FROM active_settings LIMIT 1) s
    WHERE EXISTS (SELECT 1 FROM auth_flags_junction af JOIN flags_resource f ON af.flag_id = f.id WHERE af.auth_id = a.id AND f.name = 'auth_active' AND f.value = true)
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
-- Order: alphabetical by title
departments_data AS (
    SELECT
        COALESCE(
            ARRAY_AGG(
                (d.id::text, (SELECT n.name FROM department_names_junction dn JOIN names_resource n ON dn.names_id = n.id WHERE dn.department_id = d.id LIMIT 1)::text, COALESCE((SELECT d2.description FROM department_descriptions_junction dd JOIN descriptions_resource d2 ON dd.descriptions_id = d2.id WHERE dd.department_id = d.id LIMIT 1), '')::text)::types.q_get_login_data_v4_department
                ORDER BY
                    -- Alphabetical by title
                    (SELECT n.name FROM department_names_junction dn JOIN names_resource n ON dn.names_id = n.id WHERE dn.department_id = d.id LIMIT 1)
            ),
            '{}'::types.q_get_login_data_v4_department[]
        ) as departments
    FROM department_artifact d
    WHERE EXISTS (SELECT 1 FROM department_flags_junction df JOIN flags_resource f ON df.flag_id = f.id WHERE df.department_id = d.id AND f.name = 'department_active' AND f.value = true)
),
-- Ensure departments_data always returns a row
departments_with_default AS (
    SELECT departments FROM departments_data
    UNION ALL
    SELECT '{}'::types.q_get_login_data_v4_department[] WHERE NOT EXISTS (SELECT 1 FROM departments_data)
),
-- Always use master realm (organizations replace multi-realm architecture)
realm_name_calc AS (
    SELECT 'master'::text as realm_name
),
-- Get organization_id for department (if provided)
organization_calc AS (
    SELECT
        CASE
            WHEN (SELECT department_id FROM params) IS NOT NULL THEN
                (SELECT o.id::text
                 FROM keycloak.org o
                 WHERE o.alias = (SELECT department_id FROM params)::text
                 LIMIT 1)
            ELSE NULL::text
        END as organization_id
)
-- Cross join ensures we always get exactly one row
SELECT
    p.providers as providers,
    d.departments as departments,
    COALESCE((SELECT guest_login_enabled FROM active_settings LIMIT 1), true)::boolean as guest_login_enabled,
    NULL::text as default_department_id,
    (SELECT realm_name FROM realm_name_calc LIMIT 1)::text as realm_name,
    (SELECT organization_id FROM organization_calc LIMIT 1)::text as organization_id
FROM providers_with_default p
CROSS JOIN departments_with_default d
CROSS JOIN realm_name_calc
CROSS JOIN organization_calc
LIMIT 1
$$;
