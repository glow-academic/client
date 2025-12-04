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
-- Providers query
providers_data AS (
    SELECT 
        json_agg(
            json_build_object(
                'id', a.slug,
                'name', a.name,
                'icon', a.icon_url,
                'is_default', EXISTS (SELECT 1 FROM default_providers dp WHERE dp.id = a.id)
            )
            ORDER BY a.name
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
-- Departments query
departments_data AS (
    SELECT 
        json_agg(
            json_build_object(
                'id', id::text,
                'title', title,
                'description', description
            )
            ORDER BY title
        ) as departments_json
    FROM departments 
    WHERE active = true
)
SELECT 
    COALESCE(p.providers_json, '[]'::json) as providers_json,
    COALESCE(d.departments_json, '[]'::json) as departments_json,
    COALESCE((SELECT guest_login_enabled FROM active_settings LIMIT 1), true) as guest_login_enabled
FROM providers_data p
CROSS JOIN departments_data d;

