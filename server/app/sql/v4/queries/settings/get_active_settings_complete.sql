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
    provider_key_ids uuid[]
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
    FROM setting_artifact s
    WHERE EXISTS (SELECT 1 FROM setting_flags_junction sf JOIN flags_resource f ON sf.flag_id = f.id WHERE sf.setting_id = s.id AND f.name = 'setting_active' AND sf.value = true)
      AND NOT EXISTS (
          SELECT 1 FROM department_settings_junction sd 
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
    -- Resolve department ID: use department_id if provided, otherwise get FROM profile_artifact's primary department
    SELECT 
        CASE 
            -- If department_id is provided and not empty, use it directly
            WHEN (SELECT department_id FROM params) IS NOT NULL AND (SELECT department_id FROM params) != '' THEN (SELECT department_id::uuid FROM params)
            -- Otherwise, try to get FROM profile_artifact's primary department
            ELSE (
                SELECT pd.department_id
                FROM resolve_profile_id rpi
                JOIN profile_departments_junction pd ON pd.profile_id = rpi.resolved_profile_id
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
    FROM setting_artifact s
    JOIN department_settings_junction sd ON sd.settings_id = s.id
    JOIN resolve_department_id rdi ON sd.department_id = rdi.resolved_department_id
    WHERE rdi.resolved_department_id IS NOT NULL
      AND EXISTS (SELECT 1 FROM scenario_flags_junction sf JOIN flags_resource f ON sf.flag_id = f.id WHERE sf.scenario_id = s.id AND f.name = 'scenario_active' AND sf.value = true) 
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
                    (SELECT id FROM setting_artifact WHERE EXISTS (SELECT 1 FROM setting_flags_junction sf JOIN flags_resource f ON sf.flag_id = f.id WHERE sf.setting_id = setting_artifact.id AND f.name = 'setting_active' AND sf.value = true) LIMIT 1)
                )
            -- For guest requests (no department): return default settings only
            WHEN (SELECT is_guest_flag FROM is_guest) THEN
                COALESCE(
                    (SELECT settings_id FROM default_settings),
                    (SELECT id FROM setting_artifact WHERE EXISTS (SELECT 1 FROM setting_flags_junction sf JOIN flags_resource f ON sf.flag_id = f.id WHERE sf.setting_id = setting_artifact.id AND f.name = 'setting_active' AND sf.value = true) LIMIT 1)
                )
            -- Fallback: prefer department-specific, then default, then any active
            ELSE
                COALESCE(
                    (SELECT settings_id FROM dept_specific_settings),
                    (SELECT settings_id FROM default_settings),
                    (SELECT id FROM setting_artifact WHERE EXISTS (SELECT 1 FROM setting_flags_junction sf JOIN flags_resource f ON sf.flag_id = f.id WHERE sf.setting_id = setting_artifact.id AND f.name = 'setting_active' AND sf.value = true) LIMIT 1)
                )
        END as settings_id
),
settings_auths_with_items AS (
    -- Get linked auths for this settings with nested auth_items_junction
    SELECT 
        a.id as auth_id,
        (SELECT n.name FROM agent_names_junction an JOIN names_resource n ON an.name_id = n.id WHERE an.agent_id = a.id LIMIT 1),
        COALESCE((SELECT (SELECT d.description FROM document_descriptions_junction dd JOIN descriptions_resource d ON dd.description_id = d.id WHERE dd.document_id = d.id LIMIT 1) FROM agent_descriptions_junction ad JOIN descriptions_resource d ON ad.description_id = d.id WHERE NULL::uuid = a.id LIMIT 1), '') as description,
        (SELECT s.value FROM auth_slugs_junction as_j JOIN slugs_resource s ON s.id = as_j.slug_id WHERE as_j.auth_id = a.id LIMIT 1) as slug,
        EXISTS (SELECT 1 FROM agent_flags_junction af JOIN flags_resource f ON af.flag_id = f.id WHERE af.agent_id = a.id AND f.name = 'agent_active' AND af.value = TRUE) AS active,
        COALESCE(
            ARRAY_AGG(
                (ai.id, ai.name, COALESCE(ai.description, ''), ai.encrypted)::types.q_get_settings_detail_v4_auth_item
                ORDER BY ai.name
            ) FILTER (WHERE ai.id IS NOT NULL),
            '{}'::types.q_get_settings_detail_v4_auth_item[]
        ) as auth_items_junction
    FROM selected_settings ss
    JOIN setting_auths_junction sa ON sa.settings_id = ss.settings_id AND sa.active = true
    JOIN auths_resource a ON a.id = sa.auth_id AND EXISTS (SELECT 1 FROM auth_flags_junction af JOIN flags_resource f ON af.flag_id = f.id WHERE af.auth_id = a.id AND f.name = 'auth_active' AND af.value = true)
    LEFT JOIN auth_items_junction ai_j ON ai_j.auth_id = a.id
    LEFT JOIN items_resource ai ON ai.id = ai_j.item_id
    GROUP BY a.id, (SELECT n.name FROM auth_names_junction an JOIN names_resource n ON an.name_id = n.id WHERE an.auth_id = a.id LIMIT 1), (SELECT d.description FROM auth_descriptions_junction ad JOIN descriptions_resource d ON ad.description_id = d.id WHERE ad.auth_id = a.id LIMIT 1), (SELECT s.value FROM auth_slugs_junction as_j JOIN slugs_resource s ON s.id = as_j.slug_id WHERE as_j.auth_id = a.id LIMIT 1), EXISTS (SELECT 1 FROM auth_flags_junction af JOIN flags_resource f ON af.flag_id = f.id WHERE af.auth_id = a.id AND f.name = 'auth_active' AND af.value = TRUE)
),
settings_auths_data AS (
    -- Aggregate linked auths into array
    SELECT 
        COALESCE(
            ARRAY_AGG(
                (sawi.auth_id, sawi.name, sawi.description, sawi.slug, sawi.active, sawi.auth_items_junction)::types.q_get_settings_detail_v4_auth
                ORDER BY sawi.name
            ),
            '{}'::types.q_get_settings_detail_v4_auth[]
        ) as auths,
        ARRAY_AGG(sawi.auth_id::text ORDER BY sawi.auth_id::text) FILTER (WHERE sawi.auth_id IS NOT NULL) as auth_ids
    FROM settings_auths_with_items sawi
),
settings_provider_keys_data AS (
    -- Get provider_key_ids from settings_resource
    SELECT
        COALESCE(sr.provider_key_ids, ARRAY[]::uuid[]) as provider_key_ids
    FROM selected_settings ss
    JOIN setting_settings_junction ssj ON ssj.setting_id = ss.settings_id AND ssj.active = true
    JOIN settings_resource sr ON sr.id = ssj.settings_id
    LIMIT 1
)
SELECT 
    s.id as settings_id,
    s.created_at,
    EXISTS (SELECT 1 FROM setting_flags_junction sf JOIN flags_resource f ON sf.flag_id = f.id WHERE sf.setting_id = s.id AND f.name = 'setting_active' AND sf.value = TRUE),
    (SELECT n.name FROM setting_names_junction sn JOIN names_resource n ON sn.name_id = n.id WHERE sn.setting_id = s.id LIMIT 1),
    (SELECT d.description FROM setting_descriptions_junction sd JOIN descriptions_resource d ON sd.description_id = d.id WHERE sd.setting_id = s.id LIMIT 1),
    COALESCE((SELECT c.hex_code FROM setting_colors_junction sc JOIN colors_resource c ON sc.color_id = c.id WHERE sc.setting_id = s.id AND sc.type = 'primary'::color_type LIMIT 1), '#171717'),
    COALESCE((SELECT c.hex_code FROM setting_colors_junction sc JOIN colors_resource c ON sc.color_id = c.id WHERE sc.setting_id = s.id AND sc.type = 'accent'::color_type LIMIT 1), '#f5f5f5'),
    COALESCE((SELECT c.hex_code FROM setting_colors_junction sc JOIN colors_resource c ON sc.color_id = c.id WHERE sc.setting_id = s.id AND sc.type = 'background'::color_type LIMIT 1), '#ffffff'),
    COALESCE((SELECT c.hex_code FROM setting_colors_junction sc JOIN colors_resource c ON sc.color_id = c.id WHERE sc.setting_id = s.id AND sc.type = 'surface'::color_type LIMIT 1), '#ffffff'),
    COALESCE((SELECT c.hex_code FROM setting_colors_junction sc JOIN colors_resource c ON sc.color_id = c.id WHERE sc.setting_id = s.id AND sc.type = 'success'::color_type LIMIT 1), '#009e34'),
    COALESCE((SELECT c.hex_code FROM setting_colors_junction sc JOIN colors_resource c ON sc.color_id = c.id WHERE sc.setting_id = s.id AND sc.type = 'warning'::color_type LIMIT 1), '#ea8100'),
    COALESCE((SELECT c.hex_code FROM setting_colors_junction sc JOIN colors_resource c ON sc.color_id = c.id WHERE sc.setting_id = s.id AND sc.type = 'error'::color_type LIMIT 1), '#e7000b'),
    COALESCE((SELECT c.hex_code FROM setting_colors_junction sc JOIN colors_resource c ON sc.color_id = c.id WHERE sc.setting_id = s.id AND sc.type = 'sidebar_background'::color_type LIMIT 1), '#fafafa'),
    COALESCE((SELECT c.hex_code FROM setting_colors_junction sc JOIN colors_resource c ON sc.color_id = c.id WHERE sc.setting_id = s.id AND sc.type = 'sidebar_primary'::color_type LIMIT 1), '#171717'),
    COALESCE((SELECT c.hex_code FROM setting_colors_junction sc JOIN colors_resource c ON sc.color_id = c.id WHERE sc.setting_id = s.id AND sc.type = 'chart1'::color_type LIMIT 1), '#f54900'),
    COALESCE((SELECT c.hex_code FROM setting_colors_junction sc JOIN colors_resource c ON sc.color_id = c.id WHERE sc.setting_id = s.id AND sc.type = 'chart2'::color_type LIMIT 1), '#009689'),
    COALESCE((SELECT c.hex_code FROM setting_colors_junction sc JOIN colors_resource c ON sc.color_id = c.id WHERE sc.setting_id = s.id AND sc.type = 'chart3'::color_type LIMIT 1), '#104e64'),
    COALESCE((SELECT c.hex_code FROM setting_colors_junction sc JOIN colors_resource c ON sc.color_id = c.id WHERE sc.setting_id = s.id AND sc.type = 'chart4'::color_type LIMIT 1), '#ffb900'),
    COALESCE((SELECT c.hex_code FROM setting_colors_junction sc JOIN colors_resource c ON sc.color_id = c.id WHERE sc.setting_id = s.id AND sc.type = 'chart5'::color_type LIMIT 1), '#fe9a00'),
    EXISTS (SELECT 1 FROM setting_flags_junction sf JOIN flags_resource f ON sf.flag_id = f.id WHERE sf.setting_id = s.id AND f.name = 'guest_login_enabled' AND sf.value = TRUE),
    COALESCE((SELECT p.value FROM setting_thresholds_junction st JOIN thresholds_resource p ON st.threshold_id = p.id WHERE st.setting_id = s.id AND st.type = 'success'::threshold_type LIMIT 1), 85),
    COALESCE((SELECT p.value FROM setting_thresholds_junction st JOIN thresholds_resource p ON st.threshold_id = p.id WHERE st.setting_id = s.id AND st.type = 'warning'::threshold_type LIMIT 1), 80),
    COALESCE((SELECT p.value FROM setting_thresholds_junction st JOIN thresholds_resource p ON st.threshold_id = p.id WHERE st.setting_id = s.id AND st.type = 'danger'::threshold_type LIMIT 1), 70),
    COALESCE(sad.auth_ids, ARRAY[]::text[]) as auth_ids,
    COALESCE(sad.auths, '{}'::types.q_get_settings_detail_v4_auth[]) as auths,
    COALESCE(spkd.provider_key_ids, ARRAY[]::uuid[]) as provider_key_ids
FROM selected_settings ss
JOIN setting_artifact s ON s.id = ss.settings_id
LEFT JOIN settings_auths_data sad ON true
LEFT JOIN settings_provider_keys_data spkd ON true
$$;
