-- Get template upload file path and document template args for rendering
-- Also fetches active settings for theme (following migration plan - single SQL file)
-- Converted to function pattern with settings integration
-- Uses safe drop/recreate pattern: drop function first, then recreate
-- Keeps JSONB for template_args (schema structure)

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
        WHERE proname = 'api_render_template_v3'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_render_template_v3(%s)', r.sig);
    END LOOP;
END $$;

-- 2) Recreate function with settings integration
CREATE OR REPLACE FUNCTION api_render_template_v3(
    document_id uuid,
    profile_id uuid
)
RETURNS TABLE (
    document_name text,
    actor_name text,
    file_path text,
    template_args jsonb,
    -- Settings fields for theme derivation
    settings_primary_color text,
    settings_accent text,
    settings_background text,
    settings_surface text,
    settings_success text,
    settings_warning text,
    settings_error text,
    settings_sidebar_background text,
    settings_sidebar_primary text,
    settings_chart1 text,
    settings_chart2 text,
    settings_chart3 text,
    settings_chart4 text,
    settings_chart5 text
)
LANGUAGE sql
STABLE
AS $$
WITH params AS (
    SELECT document_id AS document_id,
           profile_id AS profile_id
),
actor_profile AS (
    SELECT 
        p.id as profile_id,
        p.first_name || ' ' || p.last_name as actor_name
    FROM params x
    JOIN profiles p ON p.id = x.profile_id
),
-- Settings resolution (same logic as get_active_settings_complete.sql)
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
resolve_department_id AS (
    -- Get profile's primary department
    SELECT 
        pd.department_id as resolved_department_id
    FROM params x
    JOIN profile_departments pd ON pd.profile_id = x.profile_id
    WHERE pd.is_primary = TRUE 
      AND pd.active = true
    LIMIT 1
),
dept_specific_settings AS (
    -- Get department-specific settings (if profile has a department)
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
        COALESCE(
            (SELECT settings_id FROM dept_specific_settings),
            (SELECT settings_id FROM default_settings),
            (SELECT id FROM settings WHERE active = true LIMIT 1)
        ) as settings_id
)
SELECT 
    d.name::text as document_name,
    ap.actor_name::text as actor_name,
    u.file_path::text as file_path,
    t.args::jsonb as template_args,
    -- Settings fields
    s.primary_color::text as settings_primary_color,
    s.accent::text as settings_accent,
    s.background::text as settings_background,
    s.surface::text as settings_surface,
    s.success::text as settings_success,
    s.warning::text as settings_warning,
    s.error::text as settings_error,
    s.sidebar_background::text as settings_sidebar_background,
    s.sidebar_primary::text as settings_sidebar_primary,
    s.chart1::text as settings_chart1,
    s.chart2::text as settings_chart2,
    s.chart3::text as settings_chart3,
    s.chart4::text as settings_chart4,
    s.chart5::text as settings_chart5
FROM params x
JOIN documents d ON d.id = x.document_id
INNER JOIN document_templates dt ON dt.document_id = d.id AND dt.active = true
INNER JOIN templates t ON t.id = dt.template_id
INNER JOIN uploads u ON u.id = t.upload_id
CROSS JOIN actor_profile ap
CROSS JOIN selected_settings ss
LEFT JOIN settings s ON s.id = ss.settings_id
ORDER BY dt.created_at DESC
LIMIT 1
$$;

COMMIT;
