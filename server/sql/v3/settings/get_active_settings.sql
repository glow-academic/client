-- Get active settings row based on profile's primary department
-- Parameters: $1 = profile_id (uuid, null, empty string, or "guest-profile-id" for backward compatibility)
-- Returns: Settings row (default for null/empty/guest-profile-id, department-specific for authenticated users)
-- Logic: 
--   1. If profile_id is null, empty, or "guest-profile-id": return default settings (no department links)
--   2. If profile_id is a real UUID: get primary_department_id, then department-specific settings
--   3. Fall back to default settings (settings with no department_settings records = cross-department)
--   4. Final fallback: any active settings row
WITH default_settings AS (
    -- Get settings with no department links (cross-department/default)
    -- These are settings that have no records in department_settings
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
    -- Check if this is a guest request (empty string or "guest-profile-id" string)
    -- Parameter is passed as text (empty string for null/guest, UUID string for authenticated users)
    SELECT (
        $1::text = '' OR 
        $1::text = 'guest-profile-id'
    ) as is_guest_flag
),
resolve_profile_id AS (
    -- Resolve profile_id (keep as-is if UUID, null if guest)
    -- Parameter is passed as text (empty string for null/guest, UUID string for authenticated users)
    SELECT 
        CASE 
            WHEN $1::text = '' OR $1::text = 'guest-profile-id' THEN NULL::uuid
            ELSE $1::uuid
        END as resolved_profile_id
),
profile_primary_department AS (
    -- Get profile's primary department ID (only for authenticated users)
    SELECT pd.department_id
    FROM resolve_profile_id rpi
    JOIN profile_departments pd ON pd.profile_id = rpi.resolved_profile_id
    WHERE rpi.resolved_profile_id IS NOT NULL
      AND pd.is_primary = TRUE 
      AND pd.active = true
    LIMIT 1
),
dept_specific_settings AS (
    -- Get department-specific settings (if primary_department_id exists)
    SELECT s.id as settings_id
    FROM settings s
    JOIN department_settings sd ON sd.settings_id = s.id
    JOIN profile_primary_department ppd ON sd.department_id = ppd.department_id
    WHERE s.active = true 
      AND sd.active = true
    LIMIT 1
),
selected_settings AS (
    -- For guest-profile-id: return default settings only
    -- For authenticated users: prefer department-specific, then default, then any active
    SELECT 
        CASE 
            WHEN (SELECT is_guest_flag FROM is_guest) THEN
                COALESCE(
                    (SELECT settings_id FROM default_settings),
                    (SELECT id FROM settings WHERE active = true LIMIT 1)
                )
            ELSE
                COALESCE(
                    (SELECT settings_id FROM dept_specific_settings),
                    (SELECT settings_id FROM default_settings),
                    (SELECT id FROM settings WHERE active = true LIMIT 1)
                )
        END as settings_id
),
settings_auths_data AS (
    -- Get linked auths for this settings
    SELECT 
        ARRAY_AGG(a.id::text ORDER BY a.name) as auth_ids,
        COALESCE(
            jsonb_object_agg(
                a.id::text,
                jsonb_build_object(
                    'name', a.name,
                    'description', COALESCE(a.description, ''),
                    'slug', a.slug
                )
            ),
            '{}'::jsonb
        ) as auth_mapping
    FROM selected_settings ss
    JOIN setting_auths sa ON sa.settings_id = ss.settings_id AND sa.active = true
    JOIN auth a ON a.id = sa.auth_id AND a.active = true
),
settings_providers_data AS (
    -- Get linked providers for this settings
    SELECT 
        ARRAY_AGG(p.id::text ORDER BY p.name) as provider_ids,
        COALESCE(
            jsonb_object_agg(
                p.id::text,
                jsonb_build_object(
                    'name', p.name,
                    'description', COALESCE(p.description, ''),
                    'value', p.value
                )
            ),
            '{}'::jsonb
        ) as provider_mapping
    FROM selected_settings ss
    JOIN setting_providers sp ON sp.settings_id = ss.settings_id AND sp.active = true
    JOIN providers p ON p.id = sp.provider_id AND p.active = true
),
settings_default_guest_data AS (
    -- Get default guest account for the selected settings
    SELECT 
        sdg.profile_id::text as default_guest_profile_id,
        p.first_name || ' ' || p.last_name as default_guest_name
    FROM selected_settings ss
    JOIN settings_default_guest sdg ON sdg.settings_id = ss.settings_id AND sdg.active = true
    JOIN profiles p ON p.id = sdg.profile_id
    LIMIT 1
)
SELECT 
    s.id::text as settings_id,
    s.created_at,
    s.active,
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
    COALESCE(sad.auth_mapping, '{}'::jsonb) as auth_mapping,
    COALESCE(spd.provider_ids, ARRAY[]::text[]) as provider_ids,
    COALESCE(spd.provider_mapping, '{}'::jsonb) as provider_mapping,
    sdgd.default_guest_profile_id
FROM selected_settings ss
JOIN settings s ON s.id = ss.settings_id
LEFT JOIN settings_auths_data sad ON true
LEFT JOIN settings_providers_data spd ON true
LEFT JOIN settings_default_guest_data sdgd ON true
LIMIT 1
