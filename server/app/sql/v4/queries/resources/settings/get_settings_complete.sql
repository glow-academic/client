-- Get settings resource by ID
-- Simple data fetching for profile context 2-pass architecture
-- Parameters: id (uuid)
-- Returns: full settings data including auths and providers

-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_get_settings_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_settings_v4(%s)', r.sig);
    END LOOP;
END $$;

-- Drop types in reverse dependency order (item first, then nested types)
DROP TYPE IF EXISTS types.q_get_settings_v4_item;
DROP TYPE IF EXISTS types.q_get_settings_v4_auth;
DROP TYPE IF EXISTS types.q_get_settings_v4_provider;

-- Create nested composite types
CREATE TYPE types.q_get_settings_v4_auth AS (
    auth_id uuid,
    name text,
    description text,
    slug text
);

CREATE TYPE types.q_get_settings_v4_provider AS (
    provider_id text,
    name text,
    description text,
    value text
);

-- Create main composite type for settings item
CREATE TYPE types.q_get_settings_v4_item AS (
    settings_id text,
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
    auths types.q_get_settings_v4_auth[],
    provider_ids text[],
    providers types.q_get_settings_v4_provider[]
);

-- Create function
CREATE OR REPLACE FUNCTION api_get_settings_v4(
    settings_id_param uuid DEFAULT NULL
)
RETURNS TABLE (
    item types.q_get_settings_v4_item
)
LANGUAGE sql
STABLE
AS $$
WITH settings_auths_data AS (
    SELECT
        ARRAY_AGG(a.id::text ORDER BY (SELECT n.name FROM auth_names_junction an JOIN names_resource n ON an.name_id = n.id WHERE an.auth_id = a.id LIMIT 1)) as auth_ids,
        COALESCE(
            ARRAY_AGG(
                (a.id, (SELECT n.name FROM auth_names_junction an JOIN names_resource n ON an.name_id = n.id WHERE an.auth_id = a.id LIMIT 1), COALESCE((SELECT d.description FROM auth_descriptions_junction ad JOIN descriptions_resource d ON ad.description_id = d.id WHERE ad.auth_id = a.id LIMIT 1), ''), (SELECT sl.value FROM auth_slugs_junction as_j JOIN slugs_resource sl ON sl.id = as_j.slug_id WHERE as_j.auth_id = a.id LIMIT 1))::types.q_get_settings_v4_auth
                ORDER BY (SELECT n.name FROM auth_names_junction an JOIN names_resource n ON an.name_id = n.id WHERE an.auth_id = a.id LIMIT 1)
            ),
            ARRAY[]::types.q_get_settings_v4_auth[]
        ) as auths
    FROM setting_auths_junction sa
    JOIN auths_resource a ON a.id = sa.auth_id
        AND EXISTS (SELECT 1 FROM auth_flags_junction af JOIN flags_resource f ON af.flag_id = f.id WHERE af.auth_id = a.id AND f.name = 'auth_active' AND af.value = true)
    WHERE sa.settings_id = settings_id_param
      AND sa.active = true
),
settings_providers_data AS (
    SELECT
        ARRAY_AGG(n.name ORDER BY n.name) as provider_ids,
        COALESCE(
            ARRAY_AGG(
                (p.id::text, n.name, COALESCE((SELECT d.description FROM provider_descriptions_junction pd JOIN descriptions_resource d ON pd.description_id = d.id WHERE pd.provider_id = pr.id LIMIT 1), ''), n.name)::types.q_get_settings_v4_provider
                ORDER BY n.name
            ),
            ARRAY[]::types.q_get_settings_v4_provider[]
        ) as providers
    FROM setting_providers_junction sp
    JOIN providers_resource p ON p.id = sp.providers_id
    JOIN provider_providers_junction ppj ON ppj.providers_id = p.id
    JOIN provider_artifact pr ON pr.id = ppj.provider_id
    JOIN provider_names_junction pn ON pn.provider_id = pr.id
    JOIN names_resource n ON n.id = pn.name_id
    WHERE sp.settings_id = settings_id_param
      AND sp.active = true
)
SELECT
    (
        s.id::text,
        s.created_at,
        EXISTS (SELECT 1 FROM setting_flags_junction sf JOIN flags_resource f ON sf.flag_id = f.id WHERE sf.setting_id = s.id AND f.name = 'setting_active' AND sf.value = TRUE),
        (SELECT n.name FROM setting_names_junction sn JOIN names_resource n ON sn.name_id = n.id WHERE sn.setting_id = s.id LIMIT 1),
        (SELECT d.description FROM setting_descriptions_junction sd JOIN descriptions_resource d ON sd.description_id = d.id WHERE sd.setting_id = s.id LIMIT 1),
        (SELECT c.hex_code FROM setting_colors_junction sc JOIN colors_resource c ON sc.color_id = c.id WHERE sc.setting_id = s.id AND sc.type = 'primary'::color_type LIMIT 1),
        (SELECT c.hex_code FROM setting_colors_junction sc JOIN colors_resource c ON sc.color_id = c.id WHERE sc.setting_id = s.id AND sc.type = 'accent'::color_type LIMIT 1),
        (SELECT c.hex_code FROM setting_colors_junction sc JOIN colors_resource c ON sc.color_id = c.id WHERE sc.setting_id = s.id AND sc.type = 'background'::color_type LIMIT 1),
        (SELECT c.hex_code FROM setting_colors_junction sc JOIN colors_resource c ON sc.color_id = c.id WHERE sc.setting_id = s.id AND sc.type = 'surface'::color_type LIMIT 1),
        (SELECT c.hex_code FROM setting_colors_junction sc JOIN colors_resource c ON sc.color_id = c.id WHERE sc.setting_id = s.id AND sc.type = 'success'::color_type LIMIT 1),
        (SELECT c.hex_code FROM setting_colors_junction sc JOIN colors_resource c ON sc.color_id = c.id WHERE sc.setting_id = s.id AND sc.type = 'warning'::color_type LIMIT 1),
        (SELECT c.hex_code FROM setting_colors_junction sc JOIN colors_resource c ON sc.color_id = c.id WHERE sc.setting_id = s.id AND sc.type = 'error'::color_type LIMIT 1),
        (SELECT c.hex_code FROM setting_colors_junction sc JOIN colors_resource c ON sc.color_id = c.id WHERE sc.setting_id = s.id AND sc.type = 'sidebar_background'::color_type LIMIT 1),
        (SELECT c.hex_code FROM setting_colors_junction sc JOIN colors_resource c ON sc.color_id = c.id WHERE sc.setting_id = s.id AND sc.type = 'sidebar_primary'::color_type LIMIT 1),
        (SELECT c.hex_code FROM setting_colors_junction sc JOIN colors_resource c ON sc.color_id = c.id WHERE sc.setting_id = s.id AND sc.type = 'chart1'::color_type LIMIT 1),
        (SELECT c.hex_code FROM setting_colors_junction sc JOIN colors_resource c ON sc.color_id = c.id WHERE sc.setting_id = s.id AND sc.type = 'chart2'::color_type LIMIT 1),
        (SELECT c.hex_code FROM setting_colors_junction sc JOIN colors_resource c ON sc.color_id = c.id WHERE sc.setting_id = s.id AND sc.type = 'chart3'::color_type LIMIT 1),
        (SELECT c.hex_code FROM setting_colors_junction sc JOIN colors_resource c ON sc.color_id = c.id WHERE sc.setting_id = s.id AND sc.type = 'chart4'::color_type LIMIT 1),
        (SELECT c.hex_code FROM setting_colors_junction sc JOIN colors_resource c ON sc.color_id = c.id WHERE sc.setting_id = s.id AND sc.type = 'chart5'::color_type LIMIT 1),
        EXISTS (SELECT 1 FROM setting_flags_junction sf JOIN flags_resource f ON sf.flag_id = f.id WHERE sf.setting_id = s.id AND f.name = 'guest_login_enabled' AND sf.value = TRUE),
        (SELECT t.value FROM setting_thresholds_junction st JOIN thresholds_resource t ON st.threshold_id = t.id WHERE st.setting_id = s.id AND st.type = 'success'::threshold_type LIMIT 1),
        (SELECT t.value FROM setting_thresholds_junction st JOIN thresholds_resource t ON st.threshold_id = t.id WHERE st.setting_id = s.id AND st.type = 'warning'::threshold_type LIMIT 1),
        (SELECT t.value FROM setting_thresholds_junction st JOIN thresholds_resource t ON st.threshold_id = t.id WHERE st.setting_id = s.id AND st.type = 'danger'::threshold_type LIMIT 1),
        COALESCE(sad.auth_ids, ARRAY[]::text[]),
        COALESCE(sad.auths, ARRAY[]::types.q_get_settings_v4_auth[]),
        COALESCE(spd.provider_ids, ARRAY[]::text[]),
        COALESCE(spd.providers, ARRAY[]::types.q_get_settings_v4_provider[])
    )::types.q_get_settings_v4_item as item
FROM setting_artifact s
LEFT JOIN settings_auths_data sad ON true
LEFT JOIN settings_providers_data spd ON true
WHERE s.id = settings_id_param
  AND EXISTS (SELECT 1 FROM setting_flags_junction sf JOIN flags_resource f ON sf.flag_id = f.id WHERE sf.setting_id = s.id AND f.name = 'setting_active' AND sf.value = TRUE);
$$;
