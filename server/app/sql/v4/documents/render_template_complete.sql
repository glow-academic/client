-- Get template upload file path and document template args for rendering
-- Also fetches active settings for theme (following migration plan - single SQL file)
-- Converted to function pattern with settings integration
-- Uses safe drop/recreate pattern: drop function first, then recreate
-- Keeps JSONB for template_args (schema structure)
-- 1) Drop function first (breaks dependency on types)
-- Drop all versions of the function using DO block to handle signature variations
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'api_render_template_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_render_template_v4(%s)', r.sig);
    END LOOP;
END $$;

-- 2) Recreate function with settings integration
CREATE OR REPLACE FUNCTION api_render_template_v4(
    document_id uuid,
    profile_id uuid
)
RETURNS TABLE (
    document_name text,
    actor_name text,
    file_path text,
    schema_id uuid,
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
        COALESCE((SELECT n.name FROM profile_names pn JOIN names n ON pn.name_id = n.id WHERE pn.profile_id = p.id AND pn.type = 'first' LIMIT 1) || ' ' || (SELECT n2.name FROM profile_names pn2 JOIN names n2 ON pn2.name_id = n2.id WHERE pn2.profile_id = p.id AND pn2.type = 'last' LIMIT 1), '') as actor_name
    FROM params x
    JOIN profiles p ON p.id = x.profile_id
),
-- Settings resolution (same logic as get_active_settings_complete.sql)
default_settings AS (
    -- Get settings with no department links (cross-department/default)
    SELECT s.id as settings_id
    FROM settings s
    WHERE EXISTS (SELECT 1 FROM setting_flags sf JOIN flags fl ON sf.flag_id = fl.id WHERE sf.setting_id = s.id AND fl.name = 'active' AND sf.type = 'active'::type_setting_flags AND sf.value = true)
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
      AND EXISTS (SELECT 1 FROM setting_flags sf JOIN flags fl ON sf.flag_id = fl.id WHERE sf.setting_id = s.id AND fl.name = 'active' AND sf.type = 'active'::type_setting_flags AND sf.value = true) 
      AND sd.active = true
    LIMIT 1
),
selected_settings AS (
    -- Priority: department-specific settings, then default, then any active
    SELECT 
        COALESCE(
            (SELECT settings_id FROM dept_specific_settings),
            (SELECT settings_id FROM default_settings),
            (SELECT s.id FROM settings s WHERE EXISTS (SELECT 1 FROM setting_flags sf JOIN flags fl ON sf.flag_id = fl.id WHERE sf.setting_id = s.id AND fl.name = 'active' AND sf.type = 'active'::type_setting_flags AND sf.value = true) LIMIT 1)
        ) as settings_id
)
SELECT 
    (SELECT n.name FROM document_names dn JOIN names n ON dn.name_id = n.id WHERE dn.document_id = d.id LIMIT 1)::text as document_name,
    ap.actor_name::text as actor_name,
    u.file_path::text as file_path,
    ds.schema_id,
    -- Settings fields
    COALESCE((SELECT c.hex_code FROM setting_colors sc JOIN colors c ON sc.color_id = c.id WHERE sc.setting_id = ss.settings_id AND sc.type = 'primary'::type_setting_colors LIMIT 1), '#171717')::text as settings_primary_color,
    COALESCE((SELECT c.hex_code FROM setting_colors sc JOIN colors c ON sc.color_id = c.id WHERE sc.setting_id = ss.settings_id AND sc.type = 'accent'::type_setting_colors LIMIT 1), '#f5f5f5')::text as settings_accent,
    COALESCE((SELECT c.hex_code FROM setting_colors sc JOIN colors c ON sc.color_id = c.id WHERE sc.setting_id = ss.settings_id AND sc.type = 'background'::type_setting_colors LIMIT 1), '#ffffff')::text as settings_background,
    COALESCE((SELECT c.hex_code FROM setting_colors sc JOIN colors c ON sc.color_id = c.id WHERE sc.setting_id = ss.settings_id AND sc.type = 'surface'::type_setting_colors LIMIT 1), '#ffffff')::text as settings_surface,
    COALESCE((SELECT c.hex_code FROM setting_colors sc JOIN colors c ON sc.color_id = c.id WHERE sc.setting_id = ss.settings_id AND sc.type = 'success'::type_setting_colors LIMIT 1), '#009e34')::text as settings_success,
    COALESCE((SELECT c.hex_code FROM setting_colors sc JOIN colors c ON sc.color_id = c.id WHERE sc.setting_id = ss.settings_id AND sc.type = 'warning'::type_setting_colors LIMIT 1), '#ff9800')::text as settings_warning,
    COALESCE((SELECT c.hex_code FROM setting_colors sc JOIN colors c ON sc.color_id = c.id WHERE sc.setting_id = ss.settings_id AND sc.type = 'error'::type_setting_colors LIMIT 1), '#d32f2f')::text as settings_error,
    COALESCE((SELECT c.hex_code FROM setting_colors sc JOIN colors c ON sc.color_id = c.id WHERE sc.setting_id = ss.settings_id AND sc.type = 'sidebar_background'::type_setting_colors LIMIT 1), '#171717')::text as settings_sidebar_background,
    COALESCE((SELECT c.hex_code FROM setting_colors sc JOIN colors c ON sc.color_id = c.id WHERE sc.setting_id = ss.settings_id AND sc.type = 'sidebar_primary'::type_setting_colors LIMIT 1), '#f5f5f5')::text as settings_sidebar_primary,
    COALESCE((SELECT c.hex_code FROM setting_colors sc JOIN colors c ON sc.color_id = c.id WHERE sc.setting_id = ss.settings_id AND sc.type = 'chart1'::type_setting_colors LIMIT 1), '#1976d2')::text as settings_chart1,
    COALESCE((SELECT c.hex_code FROM setting_colors sc JOIN colors c ON sc.color_id = c.id WHERE sc.setting_id = ss.settings_id AND sc.type = 'chart2'::type_setting_colors LIMIT 1), '#388e3c')::text as settings_chart2,
    COALESCE((SELECT c.hex_code FROM setting_colors sc JOIN colors c ON sc.color_id = c.id WHERE sc.setting_id = ss.settings_id AND sc.type = 'chart3'::type_setting_colors LIMIT 1), '#f57c00')::text as settings_chart3,
    COALESCE((SELECT c.hex_code FROM setting_colors sc JOIN colors c ON sc.color_id = c.id WHERE sc.setting_id = ss.settings_id AND sc.type = 'chart4'::type_setting_colors LIMIT 1), '#7b1fa2')::text as settings_chart4,
    COALESCE((SELECT c.hex_code FROM setting_colors sc JOIN colors c ON sc.color_id = c.id WHERE sc.setting_id = ss.settings_id AND sc.type = 'chart5'::type_setting_colors LIMIT 1), '#c2185b')::text as settings_chart5
FROM params x
JOIN documents d ON d.id = x.document_id
INNER JOIN document_templates dt ON dt.document_id = d.id AND dt.active = true
INNER JOIN document_html dh ON dh.document_id = d.id AND dh.active = true
INNER JOIN html h ON h.id = dh.html_id
INNER JOIN html_uploads hu ON hu.html_id = h.id AND hu.active = true
INNER JOIN uploads u ON u.id = hu.upload_id
LEFT JOIN document_schemas ds ON ds.document_id = d.id AND ds.active = true
CROSS JOIN actor_profile ap
CROSS JOIN selected_settings ss
ORDER BY dt.created_at DESC
LIMIT 1
$$;