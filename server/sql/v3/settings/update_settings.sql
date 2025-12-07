-- Update settings: deactivate current active row, insert new active row
-- Copy links from old settings to new, then apply new key mappings
-- Parameters: 
--   $1 = primary_color (text)
--   $2 = accent (text)
--   $3 = background (text)
--   $4 = surface (text)
--   $5 = success (text)
--   $6 = warning (text)
--   $7 = error (text)
--   $8 = sidebar_background (text)
--   $9 = sidebar_primary (text)
--   $10 = chart1 (text)
--   $11 = chart2 (text)
--   $12 = chart3 (text)
--   $13 = chart4 (text)
--   $14 = chart5 (text)
--   $15 = guest_login_enabled (boolean)
--   $16 = success_threshold (integer)
--   $17 = warning_threshold (integer)
--   $18 = danger_threshold (integer)
--   $19 = profile_id (uuid or "guest-profile-id")
--   $20 = provider_key_mapping (jsonb, optional) - {provider_id: key_id}
--   $21 = auth_key_mapping (jsonb, optional) - {auth_id: {auth_item_id: key_id}}
WITH resolve_guest_profile AS (
    -- Resolve guest-profile-id using settings system (department-specific or default)
    SELECT 
        COALESCE(
            -- Department-specific settings guest profile (if user has departments)
            (SELECT sdg.profile_id FROM settings_default_guest sdg
             JOIN settings s ON s.id = sdg.settings_id AND s.active = true
             JOIN department_settings sd ON sd.settings_id = s.id AND sd.active = true
             JOIN profile_departments pd ON pd.department_id = sd.department_id AND pd.active = true
             WHERE pd.profile_id = $19::uuid AND sdg.active = true
             LIMIT 1),
            -- Fallback to default (active) settings guest profile
            (SELECT sdg.profile_id FROM settings_default_guest sdg
             JOIN settings s ON s.id = sdg.settings_id AND s.active = true
             WHERE sdg.active = true
             LIMIT 1)
        ) as guest_profile_id
),
resolve_profile_id AS (
    SELECT 
        CASE 
            WHEN $19::text = 'guest-profile-id' THEN
                (SELECT guest_profile_id FROM resolve_guest_profile)
            WHEN $19::text IS NULL OR $19::text = '' THEN NULL::uuid
            ELSE $19::uuid
        END as resolved_profile_id
),
old_settings_id AS (
    -- Capture old settings ID before deactivating
    SELECT id::text as old_id FROM settings WHERE active = true LIMIT 1
),
deactivate_current AS (
    -- Deactivate the current active settings row
    UPDATE settings
    SET active = false
    WHERE active = true
),
insert_new AS (
    -- Insert new active settings row
    INSERT INTO settings (
        active,
        primary_color,
        accent,
        background,
        surface,
        success,
        warning,
        error,
        sidebar_background,
        sidebar_primary,
        chart1,
        chart2,
        chart3,
        chart4,
        chart5,
        guest_login_enabled,
        success_threshold,
        warning_threshold,
        danger_threshold
    )
    VALUES (
        true,
        $1::text,
        $2::text,
        $3::text,
        $4::text,
        $5::text,
        $6::text,
        $7::text,
        $8::text,
        $9::text,
        $10::text,
        $11::text,
        $12::text,
        $13::text,
        $14::text,
        $15::boolean,
        $16::integer,
        $17::integer,
        $18::integer
    )
    RETURNING id::text as settings_id
),
copy_setting_providers AS (
    -- Copy setting_providers links from old settings to new
    INSERT INTO setting_providers (settings_id, provider_id, active, created_at, updated_at)
    SELECT 
        (SELECT settings_id FROM insert_new LIMIT 1)::uuid,
        sp.provider_id,
        sp.active,
        NOW(),
        NOW()
    FROM old_settings_id osi
    CROSS JOIN setting_providers sp
    WHERE sp.settings_id = osi.old_id::uuid AND sp.active = true
    ON CONFLICT (settings_id, provider_id) DO UPDATE SET
        active = true,
        updated_at = NOW()
),
copy_setting_auths AS (
    -- Copy setting_auths links from old settings to new
    INSERT INTO setting_auths (settings_id, auth_id, active, created_at, updated_at)
    SELECT 
        (SELECT settings_id FROM insert_new LIMIT 1)::uuid,
        sa.auth_id,
        sa.active,
        NOW(),
        NOW()
    FROM old_settings_id osi
    CROSS JOIN setting_auths sa
    WHERE sa.settings_id = osi.old_id::uuid AND sa.active = true
    ON CONFLICT (settings_id, auth_id) DO UPDATE SET
        active = true,
        updated_at = NOW()
),
copy_setting_auth_values AS (
    -- Copy setting_auth_values links from old settings to new (for non-encrypted items)
    INSERT INTO setting_auth_values (settings_id, auth_id, auth_item_id, value, created_at, updated_at)
    SELECT 
        (SELECT settings_id FROM insert_new LIMIT 1)::uuid,
        sav.auth_id,
        sav.auth_item_id,
        sav.value,
        NOW(),
        NOW()
    FROM old_settings_id osi
    CROSS JOIN setting_auth_values sav
    WHERE sav.settings_id = osi.old_id::uuid
    ON CONFLICT (settings_id, auth_id, auth_item_id) DO UPDATE SET
        value = EXCLUDED.value,
        updated_at = NOW()
),
apply_provider_keys AS (
    -- Apply new provider key mappings (format: {provider_id: key_id})
    -- First deactivate all existing provider keys for this settings
    UPDATE setting_provider_keys
    SET active = false, updated_at = NOW()
    WHERE settings_id = (SELECT settings_id FROM insert_new LIMIT 1)::uuid
),
insert_provider_keys AS (
    -- Insert new provider key mappings
    INSERT INTO setting_provider_keys (settings_id, provider_id, key_id, active, created_at, updated_at)
    SELECT 
        (SELECT settings_id FROM insert_new LIMIT 1)::uuid,
        (provider_id)::uuid,
        (key_id)::uuid,
        true,
        NOW(),
        NOW()
    FROM jsonb_each_text(COALESCE($20::jsonb, '{}'::jsonb)) AS t(provider_id, key_id)
    WHERE provider_id IS NOT NULL AND key_id IS NOT NULL AND provider_id != '' AND key_id != ''
    ON CONFLICT (settings_id, provider_id, key_id) DO UPDATE SET
        active = true,
        updated_at = NOW()
),
apply_auth_keys AS (
    -- Apply new auth key mappings (auth_id -> auth_item_id -> key_id)
    -- First deactivate all existing auth keys for this settings
    UPDATE setting_auth_keys
    SET active = false, updated_at = NOW()
    WHERE settings_id = (SELECT settings_id FROM insert_new LIMIT 1)::uuid
),
insert_auth_keys AS (
    -- Insert new auth key mappings
    INSERT INTO setting_auth_keys (settings_id, auth_id, auth_item_id, key_id, active, created_at, updated_at)
    SELECT 
        (SELECT settings_id FROM insert_new LIMIT 1)::uuid,
        (auth_id)::uuid,
        (auth_item_id)::uuid,
        (key_id)::uuid,
        true,
        NOW(),
        NOW()
    FROM jsonb_each(COALESCE($21::jsonb, '{}'::jsonb)) AS auth_entry(auth_id, items)
    CROSS JOIN jsonb_each_text(items) AS item_entry(auth_item_id, key_id)
    WHERE auth_id IS NOT NULL AND auth_item_id IS NOT NULL AND key_id IS NOT NULL
      AND auth_id != '' AND auth_item_id != '' AND key_id != ''
    ON CONFLICT (settings_id, auth_id, auth_item_id, key_id) DO UPDATE SET
        active = true,
        updated_at = NOW()
)
SELECT settings_id FROM insert_new

