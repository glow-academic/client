-- Get active settings row based on profile's primary department or direct department ID
-- Converted to function with composite types (NO JSONB)
-- Uses safe drop/recreate pattern: drop function first, then types (no CASCADE), then recreate
-- Reuses composite types from get_settings_detail_complete.sql
-- 1) Drop function first (breaks dependency on types)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'api_get_active_settings_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_active_settings_v4(%s)', r.sig);
    END LOOP;
END $$;

-- Note: We reuse types from get_settings_detail_complete.sql, so we don't drop them here
-- Types: q_get_settings_detail_v4_auth, q_get_settings_detail_v4_provider

-- 2) Recreate function (reuses existing types)
CREATE OR REPLACE FUNCTION api_get_active_settings_v4(
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
    auths types.q_get_settings_detail_v4_auth[],
    provider_ids text[],
    providers types.q_get_settings_detail_v4_provider[],
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
    FROM setting s
    WHERE EXISTS (SELECT 1 FROM setting_flags sf JOIN flags fl ON sf.flag_id = fl.id WHERE sf.setting_id = s.id AND fl.name = 'active' AND sf.type = 'active'::type_setting_flags AND sf.value = true)
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
    FROM setting s
    JOIN department_settings sd ON sd.settings_id = s.id
    JOIN resolve_department_id rdi ON sd.department_id = rdi.resolved_department_id
    WHERE rdi.resolved_department_id IS NOT NULL
      AND EXISTS (SELECT 1 FROM scenario_flags sf JOIN flags fl ON sf.flag_id = fl.id WHERE sf.scenario_id = s.id AND fl.name = 'active' AND sf.type = 'active'::type_scenario_flags AND sf.value = true) 
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
                    (SELECT id FROM setting WHERE EXISTS (SELECT 1 FROM setting_flags sf JOIN flags fl ON sf.flag_id = fl.id WHERE sf.setting_id = setting.id AND fl.name = 'active' AND sf.type = 'active'::type_setting_flags AND sf.value = true) LIMIT 1)
                )
            -- For guest requests (no department): return default settings only
            WHEN (SELECT is_guest_flag FROM is_guest) THEN
                COALESCE(
                    (SELECT settings_id FROM default_settings),
                    (SELECT id FROM setting WHERE EXISTS (SELECT 1 FROM setting_flags sf JOIN flags fl ON sf.flag_id = fl.id WHERE sf.setting_id = setting.id AND fl.name = 'active' AND sf.type = 'active'::type_setting_flags AND sf.value = true) LIMIT 1)
                )
            -- Fallback: prefer department-specific, then default, then any active
            ELSE
                COALESCE(
                    (SELECT settings_id FROM dept_specific_settings),
                    (SELECT settings_id FROM default_settings),
                    (SELECT id FROM setting WHERE EXISTS (SELECT 1 FROM setting_flags sf JOIN flags fl ON sf.flag_id = fl.id WHERE sf.setting_id = setting.id AND fl.name = 'active' AND sf.type = 'active'::type_setting_flags AND sf.value = true) LIMIT 1)
                )
        END as settings_id
),
settings_auths_with_items AS (
    -- Get linked auths for this settings with nested auth_items
    SELECT 
        a.id as auth_id,
        (SELECT n.name FROM agent_names an JOIN names n ON an.name_id = n.id WHERE an.agent_id = a.id LIMIT 1),
        COALESCE((SELECT (SELECT d.description FROM document_descriptions dd JOIN descriptions d ON dd.description_id = d.id WHERE dd.document_id = d.id LIMIT 1) FROM agent_descriptions ad JOIN descriptions d ON ad.description_id = d.id WHERE ad.agent_id = a.id LIMIT 1), '') as description,
        (SELECT s.value FROM auth_slugs as_j JOIN slugs s ON s.id = as_j.slug_id WHERE as_j.auth_id = a.id LIMIT 1) as slug,
        EXISTS (SELECT 1 FROM agent_flags af JOIN flags fl ON af.flag_id = fl.id WHERE af.agent_id = a.id AND fl.name = 'active' AND af.type = 'active'::type_agent_flags AND af.value = TRUE) AS active,
        COALESCE(
            ARRAY_AGG(
                (ai.id, ai.name, COALESCE(ai.description, ''), ai.encrypted)::types.q_get_settings_detail_v4_auth_item
                ORDER BY ai.name
            ) FILTER (WHERE ai.id IS NOT NULL),
            '{}'::types.q_get_settings_detail_v4_auth_item[]
        ) as auth_items
    FROM selected_settings ss
    JOIN setting_auths sa ON sa.settings_id = ss.settings_id AND sa.active = true
    JOIN auths a ON a.id = sa.auth_id AND EXISTS (SELECT 1 FROM auth_flags af JOIN flags fl ON af.flag_id = fl.id WHERE af.auth_id = a.id AND fl.name = 'active' AND af.type = 'active'::type_auth_flags AND af.value = true)
    LEFT JOIN auth_items ai_j ON ai_j.auth_id = a.id
    LEFT JOIN items ai ON ai.id = ai_j.item_id
    GROUP BY a.id, (SELECT n.name FROM auth_names an JOIN names n ON an.name_id = n.id WHERE an.auth_id = a.id LIMIT 1), (SELECT d.description FROM auth_descriptions ad JOIN descriptions d ON ad.description_id = d.id WHERE ad.auth_id = a.id LIMIT 1), (SELECT s.value FROM auth_slugs as_j JOIN slugs s ON s.id = as_j.slug_id WHERE as_j.auth_id = a.id LIMIT 1), EXISTS (SELECT 1 FROM auth_flags af JOIN flags fl ON af.flag_id = fl.id WHERE af.auth_id = a.id AND fl.name = 'active' AND af.type = 'active'::type_auth_flags AND af.value = TRUE)
),
settings_auths_data AS (
    -- Aggregate linked auths into array
    SELECT 
        COALESCE(
            ARRAY_AGG(
                (sawi.auth_id, sawi.name, sawi.description, sawi.slug, sawi.active, sawi.auth_items)::types.q_get_settings_detail_v4_auth
                ORDER BY sawi.name
            ),
            '{}'::types.q_get_settings_detail_v4_auth[]
        ) as auths,
        ARRAY_AGG(sawi.auth_id::text ORDER BY sawi.auth_id::text) FILTER (WHERE sawi.auth_id IS NOT NULL) as auth_ids
    FROM settings_auths_with_items sawi
),
settings_providers_data AS (
    -- Get linked providers for this settings (providers is now an enum)
    SELECT 
        COALESCE(
            ARRAY_AGG(
                (n.name, n.name, COALESCE((SELECT d.description FROM provider_descriptions pd JOIN descriptions d ON pd.description_id = d.id WHERE pd.provider_id = pr.id LIMIT 1), ''), n.name, sp.active)::types.q_get_settings_detail_v4_provider
                ORDER BY n.name
            ),
            '{}'::types.q_get_settings_detail_v4_provider[]
        ) as providers,
        ARRAY_AGG(n.name ORDER BY n.name) as provider_ids
    FROM selected_settings ss
    JOIN setting_providers sp ON sp.settings_id = ss.settings_id AND sp.active = true
    JOIN providers p ON p.id = sp.providers_id
    JOIN provider pr ON pr.id = p.provider_id
    JOIN provider_names pn ON pn.provider_id = pr.id
    JOIN names n ON n.id = pn.name_id
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
    EXISTS (SELECT 1 FROM setting_flags sf JOIN flags fl ON sf.flag_id = fl.id WHERE sf.setting_id = s.id AND fl.name = 'active' AND sf.type = 'active'::type_setting_flags AND sf.value = TRUE),
    (SELECT n.name FROM setting_names sn JOIN names n ON sn.name_id = n.id WHERE sn.setting_id = s.id LIMIT 1),
    (SELECT d.description FROM setting_descriptions sd JOIN descriptions d ON sd.description_id = d.id WHERE sd.setting_id = s.id LIMIT 1),
    COALESCE((SELECT c.hex_code FROM setting_colors sc JOIN colors c ON sc.color_id = c.id WHERE sc.setting_id = s.id AND sc.type = 'primary'::type_setting_colors LIMIT 1), '#171717'),
    COALESCE((SELECT c.hex_code FROM setting_colors sc JOIN colors c ON sc.color_id = c.id WHERE sc.setting_id = s.id AND sc.type = 'accent'::type_setting_colors LIMIT 1), '#f5f5f5'),
    COALESCE((SELECT c.hex_code FROM setting_colors sc JOIN colors c ON sc.color_id = c.id WHERE sc.setting_id = s.id AND sc.type = 'background'::type_setting_colors LIMIT 1), '#ffffff'),
    COALESCE((SELECT c.hex_code FROM setting_colors sc JOIN colors c ON sc.color_id = c.id WHERE sc.setting_id = s.id AND sc.type = 'surface'::type_setting_colors LIMIT 1), '#ffffff'),
    COALESCE((SELECT c.hex_code FROM setting_colors sc JOIN colors c ON sc.color_id = c.id WHERE sc.setting_id = s.id AND sc.type = 'success'::type_setting_colors LIMIT 1), '#009e34'),
    COALESCE((SELECT c.hex_code FROM setting_colors sc JOIN colors c ON sc.color_id = c.id WHERE sc.setting_id = s.id AND sc.type = 'warning'::type_setting_colors LIMIT 1), '#ea8100'),
    COALESCE((SELECT c.hex_code FROM setting_colors sc JOIN colors c ON sc.color_id = c.id WHERE sc.setting_id = s.id AND sc.type = 'error'::type_setting_colors LIMIT 1), '#e7000b'),
    COALESCE((SELECT c.hex_code FROM setting_colors sc JOIN colors c ON sc.color_id = c.id WHERE sc.setting_id = s.id AND sc.type = 'sidebar_background'::type_setting_colors LIMIT 1), '#fafafa'),
    COALESCE((SELECT c.hex_code FROM setting_colors sc JOIN colors c ON sc.color_id = c.id WHERE sc.setting_id = s.id AND sc.type = 'sidebar_primary'::type_setting_colors LIMIT 1), '#171717'),
    COALESCE((SELECT c.hex_code FROM setting_colors sc JOIN colors c ON sc.color_id = c.id WHERE sc.setting_id = s.id AND sc.type = 'chart1'::type_setting_colors LIMIT 1), '#f54900'),
    COALESCE((SELECT c.hex_code FROM setting_colors sc JOIN colors c ON sc.color_id = c.id WHERE sc.setting_id = s.id AND sc.type = 'chart2'::type_setting_colors LIMIT 1), '#009689'),
    COALESCE((SELECT c.hex_code FROM setting_colors sc JOIN colors c ON sc.color_id = c.id WHERE sc.setting_id = s.id AND sc.type = 'chart3'::type_setting_colors LIMIT 1), '#104e64'),
    COALESCE((SELECT c.hex_code FROM setting_colors sc JOIN colors c ON sc.color_id = c.id WHERE sc.setting_id = s.id AND sc.type = 'chart4'::type_setting_colors LIMIT 1), '#ffb900'),
    COALESCE((SELECT c.hex_code FROM setting_colors sc JOIN colors c ON sc.color_id = c.id WHERE sc.setting_id = s.id AND sc.type = 'chart5'::type_setting_colors LIMIT 1), '#fe9a00'),
    EXISTS (SELECT 1 FROM setting_flags sf JOIN flags fl ON sf.flag_id = fl.id WHERE sf.setting_id = s.id AND fl.name = 'guest_login_enabled' AND sf.type = 'guest_login_enabled'::type_setting_flags AND sf.value = TRUE),
    COALESCE((SELECT p.value FROM setting_thresholds st JOIN thresholds p ON st.threshold_id = p.id WHERE st.setting_id = s.id AND st.type = 'success'::type_setting_thresholds LIMIT 1), 85),
    COALESCE((SELECT p.value FROM setting_thresholds st JOIN thresholds p ON st.threshold_id = p.id WHERE st.setting_id = s.id AND st.type = 'warning'::type_setting_thresholds LIMIT 1), 80),
    COALESCE((SELECT p.value FROM setting_thresholds st JOIN thresholds p ON st.threshold_id = p.id WHERE st.setting_id = s.id AND st.type = 'danger'::type_setting_thresholds LIMIT 1), 70),
    COALESCE(sad.auth_ids, ARRAY[]::text[]) as auth_ids,
    COALESCE(sad.auths, '{}'::types.q_get_settings_detail_v4_auth[]) as auths,
    COALESCE(spd.provider_ids, ARRAY[]::text[]) as provider_ids,
    COALESCE(spd.providers, '{}'::types.q_get_settings_detail_v4_provider[]) as providers,
    sdgd.default_guest_profile_id,
    sdad.default_account_profile_id
FROM selected_settings ss
JOIN setting s ON s.id = ss.settings_id
LEFT JOIN settings_auths_data sad ON true
LEFT JOIN settings_providers_data spd ON true
LEFT JOIN settings_default_guest_data sdgd ON true
LEFT JOIN settings_default_account_data sdad ON true
$$;