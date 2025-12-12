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
),
all_providers_data AS (
    -- Get ALL providers (not just linked ones)
    SELECT 
        ARRAY_AGG(p.id::text ORDER BY p.name) as all_provider_ids,
        COALESCE(
            jsonb_object_agg(
                p.id::text,
                jsonb_build_object(
                    'name', p.name,
                    'description', COALESCE(p.description, ''),
                    'value', p.value,
                    'active', p.active
                )
            ),
            '{}'::jsonb
        ) as all_provider_mapping
    FROM providers p
    WHERE p.active = true
),
all_auths_data AS (
    -- Get ALL auths (not just linked ones)
    SELECT 
        ARRAY_AGG(a.id::text ORDER BY a.name) as all_auth_ids,
        COALESCE(
            jsonb_object_agg(
                a.id::text,
                jsonb_build_object(
                    'name', a.name,
                    'description', COALESCE(a.description, ''),
                    'slug', a.slug,
                    'active', a.active
                )
            ),
            '{}'::jsonb
        ) as all_auth_mapping
    FROM auth a
    WHERE a.active = true
),
settings_provider_keys_data AS (
    -- Get provider key mappings for this settings
    SELECT COALESCE(
        jsonb_object_agg(
            spk.provider_id::text,
            spk.key_id::text
        ),
        '{}'::jsonb
    ) as provider_key_mapping
    FROM setting_provider_keys spk
    WHERE spk.settings_id = $1::uuid AND spk.active = true
),
settings_auth_keys_data AS (
    -- Get auth key mappings (auth_id -> auth_item_id -> key_id)
    SELECT COALESCE(
        jsonb_object_agg(
            auth_id::text,
            item_key_mapping
        ),
        '{}'::jsonb
    ) as auth_key_mapping
    FROM (
        SELECT 
            sak.auth_id,
            COALESCE(
                jsonb_object_agg(
                    sak.auth_item_id::text,
                    sak.key_id::text
                ) FILTER (WHERE sak.auth_item_id IS NOT NULL),
                '{}'::jsonb
            ) as item_key_mapping
        FROM setting_auth_keys sak
        WHERE sak.settings_id = $1::uuid AND sak.active = true
        GROUP BY sak.auth_id
    ) sak_grouped
),
settings_auth_values_data AS (
    -- Get auth value mappings (auth_id -> auth_item_id -> value) for non-encrypted items
    SELECT COALESCE(
        jsonb_object_agg(
            auth_id::text,
            item_value_mapping
        ),
        '{}'::jsonb
    ) as auth_value_mapping
    FROM (
        SELECT 
            sav.auth_id,
            COALESCE(
                jsonb_object_agg(
                    sav.auth_item_id::text,
                    sav.value
                ) FILTER (WHERE sav.auth_item_id IS NOT NULL),
                '{}'::jsonb
            ) as item_value_mapping
        FROM setting_auth_values sav
        WHERE sav.settings_id = $1::uuid
        GROUP BY sav.auth_id
    ) sav_grouped
),
auth_items_data AS (
    -- Get auth items for ALL auths (not just linked ones) - to show all available auths
    SELECT 
        a.id::text as auth_id,
        COALESCE(
            jsonb_agg(
                jsonb_build_object(
                    'auth_item_id', ai.id::text,
                    'name', ai.name,
                    'description', COALESCE(ai.description, ''),
                    'encrypted', ai.encrypted
                )
                ORDER BY ai.name
            ) FILTER (WHERE ai.id IS NOT NULL),
            '[]'::jsonb
        ) as items
    FROM auth a
    LEFT JOIN auth_items ai ON ai.auth_id = a.id
    WHERE a.active = true
    GROUP BY a.id
),
auth_items_mapping_data AS (
    -- Aggregate auth items mapping
    SELECT COALESCE(
        jsonb_object_agg(
            aid.auth_id,
            aid.items
        ),
        '{}'::jsonb
    ) as auth_items_mapping
    FROM auth_items_data aid
),
settings_default_account_data AS (
    -- Get default admin/superadmin account for this settings
    SELECT 
        sda.profile_id::text as default_admin_profile_id,
        p.first_name || ' ' || p.last_name as default_admin_name,
        p.role as default_admin_role
    FROM settings_default_account sda
    JOIN profiles p ON p.id = sda.profile_id
    WHERE sda.settings_id = $1::uuid AND sda.active = true
    LIMIT 1
),
settings_default_guest_data AS (
    -- Get default guest account for this settings
    SELECT 
        sdg.profile_id::text as default_guest_profile_id,
        p.first_name || ' ' || p.last_name as default_guest_name,
        p.role as default_guest_role
    FROM settings_default_guest sdg
    JOIN profiles p ON p.id = sdg.profile_id
    WHERE sdg.settings_id = $1::uuid AND sdg.active = true
    LIMIT 1
),
settings_departments_data AS (
    -- Get linked departments for this settings
    SELECT 
        ARRAY_AGG(ds.department_id::text ORDER BY ds.created_at) as department_ids
    FROM department_settings ds
    WHERE ds.settings_id = $1::uuid AND ds.active = true
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
    COALESCE(spkd.provider_key_mapping, '{}'::jsonb) as provider_key_mapping,
    COALESCE(sakd.auth_key_mapping, '{}'::jsonb) as auth_key_mapping,
    COALESCE(savd.auth_value_mapping, '{}'::jsonb) as auth_value_mapping,
    COALESCE(aimd.auth_items_mapping, '{}'::jsonb) as auth_items_mapping,
    sdad.default_admin_profile_id,
    sdad.default_admin_name,
    sdgd.default_guest_profile_id,
    sdgd.default_guest_name,
    apd.all_provider_ids,
    apd.all_provider_mapping,
    aad.all_auth_ids,
    aad.all_auth_mapping,
    COALESCE(sdd.department_ids, NULL) as department_ids
FROM settings s
LEFT JOIN settings_auths_data sad ON true
LEFT JOIN settings_providers_data spd ON true
LEFT JOIN settings_provider_keys_data spkd ON true
LEFT JOIN settings_auth_keys_data sakd ON true
LEFT JOIN settings_auth_values_data savd ON true
LEFT JOIN auth_items_mapping_data aimd ON true
LEFT JOIN settings_default_account_data sdad ON true
LEFT JOIN settings_default_guest_data sdgd ON true
LEFT JOIN all_providers_data apd ON true
LEFT JOIN all_auths_data aad ON true
LEFT JOIN settings_departments_data sdd ON true
WHERE s.id = $1::uuid
LIMIT 1

