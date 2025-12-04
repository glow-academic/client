-- Get complete login data: providers and departments
-- Parameters: $1 = department_id (optional, UUID or NULL) for filtering providers
-- Returns: Single row with providers_json and departments_json
-- This follows DHH style: one SQL file returns all login-related data

WITH active_settings AS (
    SELECT guest_login_enabled
    FROM settings
    WHERE active = true
    LIMIT 1
),
-- Get default department from settings_default_department table
default_department_from_settings AS (
    SELECT sdd.department_id
    FROM settings s
    JOIN settings_default_department sdd ON sdd.settings_id = s.id
    WHERE s.active = true AND sdd.active = true
    LIMIT 1
),
-- Get default providers (no department links)
default_providers AS (
    SELECT a.id
    FROM auth a
    WHERE a.active = true
      AND NOT EXISTS (
          SELECT 1 FROM auth_departments ad 
          WHERE ad.auth_id = a.id AND ad.active = true
      )
),
-- Get department-specific providers (if department_id provided)
dept_providers AS (
    SELECT a.id
    FROM auth a
    JOIN auth_departments ad ON ad.auth_id = a.id
    WHERE a.active = true
      AND ad.active = true
      AND ($1::uuid IS NULL OR ad.department_id = $1::uuid)
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
                    'is_default', EXISTS (SELECT 1 FROM default_providers dp WHERE dp.id = a.id)
                )
                ORDER BY a.name
            ),
            '[]'::json
        ) as providers_json
    FROM auth a
    CROSS JOIN (SELECT guest_login_enabled FROM active_settings LIMIT 1) s
    WHERE a.active = true
      AND (
          -- Include if department_id not provided (show all)
          $1::uuid IS NULL
          -- OR include if it's a default provider (no department links)
          OR EXISTS (SELECT 1 FROM default_providers dp WHERE dp.id = a.id)
          -- OR include if it's linked to the specified department
          OR EXISTS (SELECT 1 FROM dept_providers dp WHERE dp.id = a.id)
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
)
-- Cross join ensures we always get exactly one row
SELECT 
    p.providers_json,
    d.departments_json,
    COALESCE((SELECT guest_login_enabled FROM active_settings LIMIT 1), true) as guest_login_enabled,
    (SELECT department_id::text FROM default_department_from_settings LIMIT 1) as default_department_id
FROM providers_with_default p
CROSS JOIN departments_with_default d
LIMIT 1;

