-- Combined authorization check for default-account and guest login
-- Parameters: $1 = department_id (text, optional - from cookies)
-- Returns: authorization flags for both default-account and guest login
--
-- This query performs all authorization checks in a single database round trip:
-- 1. Resolves settings (department-specific → default → any active) to get guest_login_enabled
-- 2. Counts active departments
-- 3. Counts auth providers for specific department (if department_id provided)
-- 4. Counts auth providers for default settings (no department links)
-- 5. Counts departments that have no auth providers configured
-- 6. Validates that specified department exists and is active (if department_id provided)
--
-- Authorization Logic (see Python code for detailed case analysis):
-- Default-Account: Allowed only when:
--   - Zero active departments (initial setup), OR
--   - Department provided + exists + no auth providers, OR
--   - No department + default has no auth + at least one dept without auth
-- Guest: Allowed only when guest_login_enabled = true in resolved settings
WITH default_settings AS (
    -- Get settings with no department links (cross-department/default)
    SELECT s.id as settings_id, s.guest_login_enabled
    FROM settings s
    WHERE s.active = true
      AND NOT EXISTS (
          SELECT 1 FROM department_settings sd 
          WHERE sd.settings_id = s.id AND sd.active = true
      )
    LIMIT 1
),
dept_specific_settings AS (
    -- Get department-specific settings (if department_id provided)
    SELECT s.id as settings_id, s.guest_login_enabled
    FROM settings s
    JOIN department_settings ds ON ds.settings_id = s.id AND ds.active = true
    WHERE ($1::text IS NOT NULL AND $1::text != '')
      AND ds.department_id = $1::uuid
      AND s.active = true
    LIMIT 1
),
selected_settings AS (
    -- Priority: department-specific settings, then default, then any active
    SELECT 
        COALESCE(
            (SELECT settings_id FROM dept_specific_settings),
            (SELECT settings_id FROM default_settings),
            (SELECT id FROM settings WHERE active = true LIMIT 1)
        ) as settings_id,
        COALESCE(
            (SELECT guest_login_enabled FROM dept_specific_settings),
            (SELECT guest_login_enabled FROM default_settings),
            false
        ) as guest_login_enabled
),
active_departments_count AS (
    -- Count all active departments
    SELECT COUNT(*) as count
    FROM departments
    WHERE active = true
),
department_exists_check AS (
    -- Check if the specified department exists and is active (if department_id provided)
    SELECT 
        CASE 
            WHEN ($1::text IS NOT NULL AND $1::text != '') THEN
                EXISTS(
                    SELECT 1 FROM departments d
                    WHERE d.id = $1::uuid AND d.active = true
                )
            ELSE false
        END as department_exists
),
department_auth_providers_count AS (
    -- Count auth providers for specific department (if department_id provided)
    SELECT COUNT(DISTINCT a.id) as count
    FROM departments d
    JOIN department_settings ds ON ds.department_id = d.id AND ds.active = true
    JOIN settings s ON s.id = ds.settings_id AND s.active = true
    JOIN setting_auths sa ON sa.settings_id = s.id AND sa.active = true
    JOIN auth a ON a.id = sa.auth_id AND a.active = true
    WHERE ($1::text IS NOT NULL AND $1::text != '')
      AND d.id = $1::uuid
      AND d.active = true
),
default_settings_auth_providers_count AS (
    -- Count auth providers for default settings (no department links)
    SELECT COUNT(DISTINCT a.id) as count
    FROM default_settings ds
    JOIN settings s ON s.id = ds.settings_id
    JOIN setting_auths sa ON sa.settings_id = s.id AND sa.active = true
    JOIN auth a ON a.id = sa.auth_id AND a.active = true
),
departments_without_auth_providers_count AS (
    -- Count departments that have no auth providers configured
    SELECT COUNT(DISTINCT d.id) as count
    FROM departments d
    WHERE d.active = true
      AND NOT EXISTS (
          SELECT 1
          FROM department_settings ds
          JOIN settings s ON s.id = ds.settings_id AND s.active = true
          JOIN setting_auths sa ON sa.settings_id = s.id AND sa.active = true
          JOIN auth a ON a.id = sa.auth_id AND a.active = true
          WHERE ds.department_id = d.id
            AND ds.active = true
      )
)
SELECT 
    (SELECT guest_login_enabled FROM selected_settings) as guest_login_enabled,
    (SELECT count FROM active_departments_count) as active_departments_count,
    COALESCE((SELECT count FROM department_auth_providers_count), 0) as department_auth_providers_count,
    COALESCE((SELECT count FROM default_settings_auth_providers_count), 0) as default_settings_auth_providers_count,
    COALESCE((SELECT count FROM departments_without_auth_providers_count), 0) as departments_without_auth_providers_count,
    (SELECT department_exists FROM department_exists_check) as department_exists
LIMIT 1

