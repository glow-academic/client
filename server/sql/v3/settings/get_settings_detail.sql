-- Get settings detail by ID with auth and provider info
-- Parameters: $1 = settings_id (uuid)
WITH settings_auths_data AS (
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
    FROM settings s
    JOIN setting_auths sa ON sa.settings_id = s.id AND sa.active = true
    JOIN auth a ON a.id = sa.auth_id AND a.active = true
    WHERE s.id = $1::uuid
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
    FROM settings s
    JOIN setting_providers sp ON sp.settings_id = s.id AND sp.active = true
    JOIN providers p ON p.id = sp.provider_id AND p.active = true
    WHERE s.id = $1::uuid
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
    COALESCE(spd.provider_mapping, '{}'::jsonb) as provider_mapping
FROM settings s
LEFT JOIN settings_auths_data sad ON true
LEFT JOIN settings_providers_data spd ON true
WHERE s.id = $1::uuid
LIMIT 1

