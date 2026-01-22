-- Combined authorization check for default-account and guest login
-- Converted to PostgreSQL function
-- Uses safe drop/recreate pattern: drop function first, then types (no CASCADE), then recreate
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
-- 1) Drop function first (breaks dependency on types)
-- Drop all versions of the function using DO block to handle signature variations
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'api_check_login_authorization_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_check_login_authorization_v4(%s)', r.sig);
    END LOOP;
END $$;

-- 2) Drop types WITHOUT CASCADE
-- No composite types needed for this function (returns simple types)

-- 3) Recreate function
CREATE OR REPLACE FUNCTION api_check_login_authorization_v4(
    department_id text DEFAULT NULL
)
RETURNS TABLE (
    guest_login_enabled boolean,
    active_departments_count bigint,
    department_auth_providers_count bigint,
    default_settings_auth_providers_count bigint,
    departments_without_auth_providers_count bigint,
    department_exists boolean
)
LANGUAGE sql
STABLE
AS $$
WITH params_normalized AS (
    -- Normalize department_id: convert empty string to NULL
    SELECT 
        CASE 
            WHEN department_id IS NULL OR department_id = '' THEN NULL::uuid
            ELSE department_id::uuid
        END as department_id_uuid
),
default_settings AS (
    -- Get settings with no department links (cross-department/default)
    SELECT 
        s.id as settings_id,
        EXISTS (SELECT 1 FROM setting_flags sf JOIN flags_resource f ON sf.flag_id = f.id WHERE sf.setting_id = s.id AND f.name = 'guest_login_enabled' AND sf.value = TRUE) as guest_login_enabled
    FROM setting_artifact s
    WHERE EXISTS (SELECT 1 FROM setting_flags sf JOIN flags_resource f ON sf.flag_id = f.id WHERE sf.setting_id = s.id AND f.name = 'setting_active' AND sf.value = TRUE)
      AND NOT EXISTS (
          SELECT 1 FROM department_settings sd 
          WHERE sd.settings_id = s.id AND sd.active = true
      )
    LIMIT 1
),
dept_specific_settings AS (
    -- Get department-specific settings (if department_id provided)
    SELECT 
        s.id as settings_id,
        EXISTS (SELECT 1 FROM setting_flags sf JOIN flags_resource f ON sf.flag_id = f.id WHERE sf.setting_id = s.id AND f.name = 'guest_login_enabled' AND sf.value = TRUE) as guest_login_enabled
    FROM setting_artifact s
    JOIN department_settings ds ON ds.settings_id = s.id AND ds.active = true
    CROSS JOIN params_normalized pn
    WHERE pn.department_id_uuid IS NOT NULL
      AND ds.department_id = pn.department_id_uuid
      AND EXISTS (SELECT 1 FROM setting_flags sf JOIN flags_resource f ON sf.flag_id = f.id WHERE sf.setting_id = s.id AND f.name = 'setting_active' AND sf.value = TRUE)
    LIMIT 1
),
selected_settings AS (
    -- Priority: department-specific settings, then default, then any active
    SELECT 
        COALESCE(
            (SELECT settings_id FROM dept_specific_settings),
            (SELECT settings_id FROM default_settings),
            (SELECT id FROM setting_artifact WHERE EXISTS (SELECT 1 FROM setting_flags sf JOIN flags_resource f ON sf.flag_id = f.id WHERE sf.setting_id = setting_artifact.id AND f.name = 'setting_active' AND sf.value = TRUE) LIMIT 1)
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
    FROM department_artifact
    WHERE EXISTS (SELECT 1 FROM department_flags df JOIN flags_resource f ON df.flag_id = f.id WHERE df.department_id = department_artifact.id AND f.name = 'department_active' AND df.value = true)
),
department_exists_check AS (
    -- Check if the specified department exists and is active (if department_id provided)
    SELECT 
        CASE 
            WHEN pn.department_id_uuid IS NOT NULL THEN
                EXISTS(
                    SELECT 1 FROM department_artifact d
                    CROSS JOIN params_normalized pn
                    WHERE d.id = pn.department_id_uuid
                    AND EXISTS (SELECT 1 FROM department_flags df JOIN flags_resource f ON df.flag_id = f.id WHERE df.department_id = d.id AND f.name = 'department_active' AND df.value = true)
                )
            ELSE false
        END as department_exists
    FROM params_normalized pn
),
department_auth_providers_count AS (
    -- Count auth providers for specific department (if department_id provided)
    SELECT COUNT(DISTINCT a.id) as count
    FROM department_artifact d
    JOIN department_settings ds ON ds.department_id = d.id AND ds.active = true
    JOIN setting_artifact s ON s.id = ds.settings_id AND EXISTS (SELECT 1 FROM setting_flags sf JOIN flags_resource f ON sf.flag_id = f.id WHERE sf.setting_id = s.id AND f.name = 'setting_active' AND sf.value = TRUE)
    JOIN setting_auths sa ON sa.settings_id = s.id AND sa.active = true
    JOIN auths_resource a ON a.id = sa.auth_id AND EXISTS (SELECT 1 FROM auth_flags af JOIN flags_resource f ON af.flag_id = f.id WHERE af.auth_id = a.id AND f.name = 'auth_active' AND af.value = true)
    CROSS JOIN params_normalized pn
    WHERE pn.department_id_uuid IS NOT NULL
      AND d.id = pn.department_id_uuid
      AND EXISTS (SELECT 1 FROM department_flags df JOIN flags_resource f ON df.flag_id = f.id WHERE df.department_id = d.id AND f.name = 'department_active' AND df.value = true)
),
default_settings_auth_providers_count AS (
    -- Count auth providers for default settings (no department links)
    SELECT COUNT(DISTINCT a.id) as count
    FROM default_settings ds
    JOIN setting_artifact s ON s.id = ds.settings_id
    JOIN setting_auths sa ON sa.settings_id = s.id AND sa.active = true
    JOIN auths_resource a ON a.id = sa.auth_id AND EXISTS (SELECT 1 FROM auth_flags af JOIN flags_resource f ON af.flag_id = f.id WHERE af.auth_id = a.id AND f.name = 'auth_active' AND af.value = true)
),
departments_without_auth_providers_count AS (
    -- Count departments that have no auth providers configured
    SELECT COUNT(DISTINCT d.id) as count
    FROM department_artifact d
    WHERE EXISTS (SELECT 1 FROM department_flags df JOIN flags_resource f ON df.flag_id = f.id WHERE df.department_id = d.id AND f.name = 'department_active' AND df.value = true)
      AND NOT EXISTS (
          SELECT 1
          FROM department_settings ds
          JOIN setting_artifact s ON s.id = ds.settings_id AND EXISTS (SELECT 1 FROM setting_flags sf JOIN flags_resource f ON sf.flag_id = f.id WHERE sf.setting_id = s.id AND f.name = 'setting_active' AND sf.value = TRUE)
          JOIN setting_auths sa ON sa.settings_id = s.id AND sa.active = true
          JOIN auths_resource a ON a.id = sa.auth_id AND EXISTS (SELECT 1 FROM auth_flags af JOIN flags_resource f ON af.flag_id = f.id WHERE af.auth_id = a.id AND f.name = 'auth_active' AND af.value = true)
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
$$;