-- Get complete login data: providers and departments
-- Parameters: $1 = department_id (optional, UUID or NULL) for filtering providers
-- Returns: Single row with providers_json and departments_json
-- This follows DHH style: one SQL file returns all login-related data

WITH
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
      AND ($1::uuid IS NULL OR ds.department_id = $1::uuid)
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
            WHEN $1::uuid IS NOT NULL THEN (SELECT guest_login_enabled FROM dept_settings LIMIT 1)
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
            json_agg(
                json_build_object(
                    'id', a.slug,
                    'name', a.name,
                    'icon', a.icon_url,
                    'is_default', EXISTS (SELECT 1 FROM default_auths da WHERE da.id = a.id)
                )
                ORDER BY a.name
            ),
            '[]'::json
        ) as providers_json
    FROM auth a
    CROSS JOIN (SELECT guest_login_enabled FROM active_settings LIMIT 1) s
    WHERE a.active = true
      AND (
          -- Include if department_id not provided (show all auths from all settings)
          $1::uuid IS NULL
          -- OR if department_id is provided, ONLY include department-specific auths (exclude default ones)
          OR (
              $1::uuid IS NOT NULL
              AND EXISTS (SELECT 1 FROM dept_auths da WHERE da.id = a.id)
          )
      )
),
-- Ensure providers_data always returns a row
providers_with_default AS (
    SELECT providers_json FROM providers_data
    UNION ALL
    SELECT '[]'::json WHERE NOT EXISTS (SELECT 1 FROM providers_data)
),
-- Departments query (always returns at least one row)
-- Order: default department first, then alphabetical by title
departments_data AS (
    SELECT 
        COALESCE(
            json_agg(
                json_build_object(
                    'id', id::text,
                    'title', title,
                    'description', description
                )
                ORDER BY 
                    -- Default department first (NULLS LAST means non-defaults come after)
                    CASE WHEN id = (SELECT department_id FROM default_department_from_settings LIMIT 1) 
                         THEN 0 ELSE 1 END,
                    -- Then alphabetical by title
                    title
            ),
            '[]'::json
        ) as departments_json
    FROM departments 
    WHERE active = true
),
-- Ensure departments_data always returns a row
departments_with_default AS (
    SELECT departments_json FROM departments_data
    UNION ALL
    SELECT '[]'::json WHERE NOT EXISTS (SELECT 1 FROM departments_data)
),
-- Calculate realm name: use settings_id if dept settings has keys, else 'master'
-- Simplified: Check if dept settings has keys, if yes use settings_id, else 'master'
realm_name_calc AS (
    SELECT 
        CASE 
            -- No department → master realm
            WHEN $1::uuid IS NULL THEN 'master'::text
            -- Check if department-specific settings has keys
            WHEN EXISTS (
                SELECT 1 
                FROM department_settings ds
                JOIN settings s ON s.id = ds.settings_id AND s.active = true
                JOIN setting_auth_keys sak ON sak.settings_id = s.id AND sak.active = true
                WHERE ds.department_id = $1::uuid AND ds.active = true
            ) THEN (
                -- Department settings has keys → use settings_id as realm
                SELECT s.id::text
                FROM department_settings ds
                JOIN settings s ON s.id = ds.settings_id AND s.active = true
                WHERE ds.department_id = $1::uuid AND ds.active = true
                LIMIT 1
            )
            -- No keys in dept settings → use master realm
            ELSE 'master'::text
        END as realm_name
)
-- Cross join ensures we always get exactly one row
SELECT 
    p.providers_json,
    d.departments_json,
    COALESCE((SELECT guest_login_enabled FROM active_settings LIMIT 1), true) as guest_login_enabled,
    (SELECT department_id::text FROM default_department_from_settings LIMIT 1) as default_department_id,
    (SELECT realm_name FROM realm_name_calc LIMIT 1) as realm_name
FROM providers_with_default p
CROSS JOIN departments_with_default d
CROSS JOIN realm_name_calc
LIMIT 1;

