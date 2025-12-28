-- Get active settings row based on profile's primary department or direct department ID
-- Converted to function with composite types (NO JSONB)
-- Uses safe drop/recreate pattern: drop function first, then types (no CASCADE), then recreate
-- Reuses composite types from get_settings_detail_complete.sql

BEGIN;

-- 1) Drop function first (breaks dependency on types)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'api_get_active_settings_v3'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_active_settings_v3(%s)', r.sig);
    END LOOP;
END $$;

-- Note: We reuse types from get_settings_detail_complete.sql, so we don't drop them here
-- Types: q_get_settings_detail_v3_auth, q_get_settings_detail_v3_provider

-- 2) Recreate function (reuses existing types)
CREATE OR REPLACE FUNCTION api_get_active_settings_v3(
    profile_id text,  -- Empty string for null/guest
    department_id text DEFAULT ''  -- Empty string for null
)
RETURNS TABLE (
    settings_id uuid,
    created_at timestamptz,
    active boolean,
    name text,
    description text,
    primary_color text,
    accent text,
    background text,
    surface text,
    success text,
    warning text,
    error text,
    sidebar_background text,
    sidebar_primary text,
    chart1 text,
    chart2 text,
    chart3 text,
    chart4 text,
    chart5 text,
    guest_login_enabled boolean,
    success_threshold integer,
    warning_threshold integer,
    danger_threshold integer,
    auth_ids text[],
    auths types.q_get_settings_detail_v3_auth[],
    provider_ids text[],
    providers types.q_get_settings_detail_v3_provider[],
    default_guest_profile_id uuid,
    default_account_profile_id uuid
)
LANGUAGE sql
STABLE
AS $$
WITH params AS (
    SELECT 
        profile_id AS profile_id,
        department_id AS department_id
),
default_settings AS (
    -- Get settings with no department links (cross-department/default)
    SELECT s.id as settings_id
    FROM settings s
    WHERE s.active = true
      AND NOT EXISTS (
          SELECT 1 FROM department_settings sd 
          WHERE sd.settings_id = s.id AND sd.active = true
      )
    LIMIT 1
),
is_guest AS (
    -- Check if this is a guest request (empty string)
    SELECT (profile_id = '') as is_guest_flag
    FROM params
),
resolve_profile_id AS (
    -- Resolve profile_id (keep as-is if UUID, null if guest)
    SELECT 
        CASE 
            WHEN (SELECT profile_id FROM params) = '' THEN NULL::uuid
            ELSE (SELECT profile_id::uuid FROM params)
        END as resolved_profile_id
),
resolve_department_id AS (
    -- Resolve department ID: use department_id if provided, otherwise get from profile's primary department
    SELECT 
        CASE 
            -- If department_id is provided and not empty, use it directly
            WHEN (SELECT department_id FROM params) IS NOT NULL AND (SELECT department_id FROM params) != '' THEN (SELECT department_id::uuid FROM params)
            -- Otherwise, try to get from profile's primary department
            ELSE (
                SELECT pd.department_id
                FROM resolve_profile_id rpi
                JOIN profile_departments pd ON pd.profile_id = rpi.resolved_profile_id
                WHERE rpi.resolved_profile_id IS NOT NULL
                  AND pd.is_primary = TRUE 
                  AND pd.active = true
                LIMIT 1
            )
        END as resolved_department_id
),
dept_specific_settings AS (
    -- Get department-specific settings (if resolved_department_id exists)
    SELECT s.id as settings_id
    FROM settings s
    JOIN department_settings sd ON sd.settings_id = s.id
    JOIN resolve_department_id rdi ON sd.department_id = rdi.resolved_department_id
    WHERE rdi.resolved_department_id IS NOT NULL
      AND s.active = true 
      AND sd.active = true
    LIMIT 1
),
selected_settings AS (
    -- Priority: department-specific settings, then default, then any active
    SELECT 
        CASE 
            -- If departmentId is provided or profile has a department, prefer department-specific settings
            WHEN (SELECT resolved_department_id FROM resolve_department_id) IS NOT NULL THEN
                COALESCE(
                    (SELECT settings_id FROM dept_specific_settings),
                    (SELECT settings_id FROM default_settings),
                    (SELECT id FROM settings WHERE active = true LIMIT 1)
                )
            -- For guest requests (no department): return default settings only
            WHEN (SELECT is_guest_flag FROM is_guest) THEN
                COALESCE(
                    (SELECT settings_id FROM default_settings),
                    (SELECT id FROM settings WHERE active = true LIMIT 1)
                )
            -- Fallback: prefer department-specific, then default, then any active
            ELSE
                COALESCE(
                    (SELECT settings_id FROM dept_specific_settings),
                    (SELECT settings_id FROM default_settings),
                    (SELECT id FROM settings WHERE active = true LIMIT 1)
                )
        END as settings_id
),
settings_auths_with_items AS (
    -- Get linked auths for this settings with nested auth_items
    SELECT 
        a.id as auth_id,
        a.name,
        COALESCE(a.description, '') as description,
        a.slug,
        a.active,
        COALESCE(
            ARRAY_AGG(
                (ai.id, ai.name, COALESCE(ai.description, ''), ai.encrypted)::types.q_get_settings_detail_v3_auth_item
                ORDER BY ai.name
            ) FILTER (WHERE ai.id IS NOT NULL),
            '{}'::types.q_get_settings_detail_v3_auth_item[]
        ) as auth_items
    FROM selected_settings ss
    JOIN setting_auths sa ON sa.settings_id = ss.settings_id AND sa.active = true
    JOIN auth a ON a.id = sa.auth_id AND a.active = true
    LEFT JOIN auth_items ai ON ai.auth_id = a.id
    GROUP BY a.id, a.name, a.description, a.slug, a.active
),
settings_auths_data AS (
    -- Aggregate linked auths into array
    SELECT 
        COALESCE(
            ARRAY_AGG(
                (sawi.auth_id, sawi.name, sawi.description, sawi.slug, sawi.active, sawi.auth_items)::types.q_get_settings_detail_v3_auth
                ORDER BY sawi.name
            ),
            '{}'::types.q_get_settings_detail_v3_auth[]
        ) as auths,
        ARRAY_AGG(sawi.auth_id::text ORDER BY sawi.auth_id::text) FILTER (WHERE sawi.auth_id IS NOT NULL) as auth_ids
    FROM settings_auths_with_items sawi
),
settings_providers_data AS (
    -- Get linked providers for this settings
    SELECT 
        COALESCE(
            ARRAY_AGG(
                (p.id, p.name, COALESCE(p.description, ''), p.value, p.active)::types.q_get_settings_detail_v3_provider
                ORDER BY p.name
            ),
            '{}'::types.q_get_settings_detail_v3_provider[]
        ) as providers,
        ARRAY_AGG(p.id::text ORDER BY p.id::text) FILTER (WHERE p.id IS NOT NULL) as provider_ids
    FROM selected_settings ss
    JOIN setting_providers sp ON sp.settings_id = ss.settings_id AND sp.active = true
    JOIN providers p ON p.id = sp.provider_id AND p.active = true
),
settings_default_guest_data AS (
    -- Get default guest account: try selected settings first, fall back to default settings
    SELECT 
        COALESCE(
            (SELECT sdg.profile_id
             FROM selected_settings ss
             JOIN settings_default_guest sdg ON sdg.settings_id = ss.settings_id AND sdg.active = true
             LIMIT 1),
            (SELECT sdg.profile_id
             FROM default_settings ds
             JOIN settings_default_guest sdg ON sdg.settings_id = ds.settings_id AND sdg.active = true
             LIMIT 1)
        ) as default_guest_profile_id
),
settings_default_account_data AS (
    -- Get default account: try selected settings first, fall back to default settings
    SELECT 
        COALESCE(
            (SELECT sda.profile_id
             FROM selected_settings ss
             JOIN settings_default_account sda ON sda.settings_id = ss.settings_id AND sda.active = true
             LIMIT 1),
            (SELECT sda.profile_id
             FROM default_settings ds
             JOIN settings_default_account sda ON sda.settings_id = ds.settings_id AND sda.active = true
             LIMIT 1)
        ) as default_account_profile_id
)
SELECT 
    s.id as settings_id,
    s.created_at,
    s.active,
    s.name,
    s.description,
    s.primary_color,
    s.accent,
    s.background,
    s.surface,
    s.success,
    s.warning,
    s.error,
    s.sidebar_background,
    s.sidebar_primary,
    s.chart1,
    s.chart2,
    s.chart3,
    s.chart4,
    s.chart5,
    s.guest_login_enabled,
    s.success_threshold,
    s.warning_threshold,
    s.danger_threshold,
    COALESCE(sad.auth_ids, ARRAY[]::text[]) as auth_ids,
    COALESCE(sad.auths, '{}'::types.q_get_settings_detail_v3_auth[]) as auths,
    COALESCE(spd.provider_ids, ARRAY[]::text[]) as provider_ids,
    COALESCE(spd.providers, '{}'::types.q_get_settings_detail_v3_provider[]) as providers,
    sdgd.default_guest_profile_id,
    sdad.default_account_profile_id
FROM selected_settings ss
JOIN settings s ON s.id = ss.settings_id
LEFT JOIN settings_auths_data sad ON true
LEFT JOIN settings_providers_data spd ON true
LEFT JOIN settings_default_guest_data sdgd ON true
LEFT JOIN settings_default_account_data sdad ON true
$$;

COMMIT;

