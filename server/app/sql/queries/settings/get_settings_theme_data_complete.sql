-- Get settings theme data only (lightweight for profile context)
-- Parameters: settings_id (uuid)
-- Returns: colors and thresholds only - no auths/providers

-- Drop function if exists
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_get_settings_theme_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_settings_theme_v4(%s)', r.sig);
    END LOOP;
END $$;

-- Create function
CREATE OR REPLACE FUNCTION api_get_settings_theme_v4(
    settings_id_param uuid DEFAULT NULL
)
RETURNS TABLE (
    -- Colors
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
    -- Thresholds
    success_threshold integer,
    warning_threshold integer,
    danger_threshold integer
)
LANGUAGE sql
STABLE
AS $$
SELECT
    (SELECT c.hex_code FROM setting_colors_junction sc JOIN colors_resource c ON sc.color_id = c.id WHERE sc.setting_id = s.id AND c.type = 'primary'::color_type LIMIT 1) as primary_color,
    (SELECT c.hex_code FROM setting_colors_junction sc JOIN colors_resource c ON sc.color_id = c.id WHERE sc.setting_id = s.id AND c.type = 'accent'::color_type LIMIT 1) as accent,
    (SELECT c.hex_code FROM setting_colors_junction sc JOIN colors_resource c ON sc.color_id = c.id WHERE sc.setting_id = s.id AND c.type = 'background'::color_type LIMIT 1) as background,
    (SELECT c.hex_code FROM setting_colors_junction sc JOIN colors_resource c ON sc.color_id = c.id WHERE sc.setting_id = s.id AND c.type = 'surface'::color_type LIMIT 1) as surface,
    (SELECT c.hex_code FROM setting_colors_junction sc JOIN colors_resource c ON sc.color_id = c.id WHERE sc.setting_id = s.id AND c.type = 'success'::color_type LIMIT 1) as success,
    (SELECT c.hex_code FROM setting_colors_junction sc JOIN colors_resource c ON sc.color_id = c.id WHERE sc.setting_id = s.id AND c.type = 'warning'::color_type LIMIT 1) as warning,
    (SELECT c.hex_code FROM setting_colors_junction sc JOIN colors_resource c ON sc.color_id = c.id WHERE sc.setting_id = s.id AND c.type = 'error'::color_type LIMIT 1) as error,
    (SELECT c.hex_code FROM setting_colors_junction sc JOIN colors_resource c ON sc.color_id = c.id WHERE sc.setting_id = s.id AND c.type = 'sidebar_background'::color_type LIMIT 1) as sidebar_background,
    (SELECT c.hex_code FROM setting_colors_junction sc JOIN colors_resource c ON sc.color_id = c.id WHERE sc.setting_id = s.id AND c.type = 'sidebar_primary'::color_type LIMIT 1) as sidebar_primary,
    (SELECT c.hex_code FROM setting_colors_junction sc JOIN colors_resource c ON sc.color_id = c.id WHERE sc.setting_id = s.id AND c.type = 'chart1'::color_type LIMIT 1) as chart1,
    (SELECT c.hex_code FROM setting_colors_junction sc JOIN colors_resource c ON sc.color_id = c.id WHERE sc.setting_id = s.id AND c.type = 'chart2'::color_type LIMIT 1) as chart2,
    (SELECT c.hex_code FROM setting_colors_junction sc JOIN colors_resource c ON sc.color_id = c.id WHERE sc.setting_id = s.id AND c.type = 'chart3'::color_type LIMIT 1) as chart3,
    (SELECT c.hex_code FROM setting_colors_junction sc JOIN colors_resource c ON sc.color_id = c.id WHERE sc.setting_id = s.id AND c.type = 'chart4'::color_type LIMIT 1) as chart4,
    (SELECT c.hex_code FROM setting_colors_junction sc JOIN colors_resource c ON sc.color_id = c.id WHERE sc.setting_id = s.id AND c.type = 'chart5'::color_type LIMIT 1) as chart5,
    (SELECT t.value FROM setting_thresholds_junction st JOIN thresholds_resource t ON st.threshold_id = t.id WHERE st.setting_id = s.id AND t.type = 'success'::threshold_type LIMIT 1) as success_threshold,
    (SELECT t.value FROM setting_thresholds_junction st JOIN thresholds_resource t ON st.threshold_id = t.id WHERE st.setting_id = s.id AND t.type = 'warning'::threshold_type LIMIT 1) as warning_threshold,
    (SELECT t.value FROM setting_thresholds_junction st JOIN thresholds_resource t ON st.threshold_id = t.id WHERE st.setting_id = s.id AND t.type = 'danger'::threshold_type LIMIT 1) as danger_threshold
FROM setting_artifact s
WHERE s.id = settings_id_param
  AND EXISTS (SELECT 1 FROM setting_flags_junction sf JOIN flags_resource f ON sf.flag_id = f.id WHERE sf.setting_id = s.id AND f.name = 'setting_active' AND f.value = TRUE);
$$;
