-- Update settings: deactivate current active row, insert new active row
-- Copy links from old settings to new, then apply new key mappings
-- Parameters: 
--   $1 = name (text)
--   $2 = description (text)
--   $3 = primary_color (text)
--   $4 = accent (text)
--   $5 = background (text)
--   $6 = surface (text)
--   $7 = success (text)
--   $8 = warning (text)
--   $9 = error (text)
--   $10 = sidebar_background (text)
--   $11 = sidebar_primary (text)
--   $12 = chart1 (text)
--   $13 = chart2 (text)
--   $14 = chart3 (text)
--   $15 = chart4 (text)
--   $16 = chart5 (text)
--   $17 = guest_login_enabled (boolean)
--   $18 = success_threshold (integer)
--   $19 = warning_threshold (integer)
--   $20 = danger_threshold (integer)
--   $21 = profile_id (uuid or "guest-profile-id")
--   $22 = provider_key_mapping (jsonb, optional) - {provider_id: key_id}
--   $23 = auth_key_mapping (jsonb, optional) - {auth_id: {auth_item_id: key_id}}
--   $24 = default_admin_profile_id (text, optional) - Default admin/superadmin profile ID
--   $25 = default_guest_profile_id (text, optional) - Default guest profile ID
--   $26 = provider_enabled (jsonb, optional) - {provider_id: enabled (boolean)}
--   $27 = auth_enabled (jsonb, optional) - {auth_id: enabled (boolean)}
--   $28 = auth_value_mapping (jsonb, optional) - {auth_id: {auth_item_id: value}} for non-encrypted items
--   $29 = department_ids (text array, nullable) - Empty array = global settings, non-empty = department-specific
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
        name,
        description,
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
        $15::text,
        $16::text,
        $17::boolean,
        $18::integer,
        $19::integer,
        $20::integer
    )
    RETURNING id::text as settings_id
),
manage_setting_providers AS (
    -- Manage provider links based on provider_enabled mapping
    -- If provider_enabled is provided, use it; otherwise copy from old settings
    INSERT INTO setting_providers (settings_id, provider_id, active, created_at, updated_at)
    SELECT 
        (SELECT settings_id FROM insert_new LIMIT 1)::uuid,
        (provider_id)::uuid,
        (enabled::boolean),
        NOW(),
        NOW()
    FROM jsonb_each_text(COALESCE($26::jsonb, '{}'::jsonb)) AS t(provider_id, enabled)
    WHERE provider_id IS NOT NULL AND provider_id != ''
    ON CONFLICT (settings_id, provider_id) DO UPDATE SET
        active = (EXCLUDED.active),
        updated_at = NOW()
),
copy_setting_providers_fallback AS (
    -- Fallback: Copy setting_providers links from old settings to new (if provider_enabled not provided)
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
      AND NOT EXISTS (
          SELECT 1 FROM jsonb_each_text(COALESCE($26::jsonb, '{}'::jsonb)) AS t(provider_id, enabled)
          WHERE t.provider_id = sp.provider_id::text
      )
    ON CONFLICT (settings_id, provider_id) DO UPDATE SET
        active = COALESCE(EXCLUDED.active, setting_providers.active),
        updated_at = NOW()
),
manage_setting_auths AS (
    -- Manage auth links based on auth_enabled mapping
    -- If auth_enabled is provided, use it; otherwise copy from old settings
    INSERT INTO setting_auths (settings_id, auth_id, active, created_at, updated_at)
    SELECT 
        (SELECT settings_id FROM insert_new LIMIT 1)::uuid,
        (auth_id)::uuid,
        (enabled::boolean),
        NOW(),
        NOW()
    FROM jsonb_each_text(COALESCE($27::jsonb, '{}'::jsonb)) AS t(auth_id, enabled)
    WHERE auth_id IS NOT NULL AND auth_id != ''
    ON CONFLICT (settings_id, auth_id) DO UPDATE SET
        active = (EXCLUDED.active),
        updated_at = NOW()
),
copy_setting_auths_fallback AS (
    -- Fallback: Copy setting_auths links from old settings to new (if auth_enabled not provided)
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
      AND NOT EXISTS (
          SELECT 1 FROM jsonb_each_text(COALESCE($27::jsonb, '{}'::jsonb)) AS t(auth_id, enabled)
          WHERE t.auth_id = sa.auth_id::text
      )
    ON CONFLICT (settings_id, auth_id) DO UPDATE SET
        active = COALESCE(EXCLUDED.active, setting_auths.active),
        updated_at = NOW()
),
manage_setting_auth_values AS (
    -- Manage auth values based on auth_value_mapping (for non-encrypted items)
    INSERT INTO setting_auth_values (settings_id, auth_id, auth_item_id, value, created_at, updated_at)
    SELECT 
        (SELECT settings_id FROM insert_new LIMIT 1)::uuid,
        (auth_id)::uuid,
        (auth_item_id)::uuid,
        (value::text),
        NOW(),
        NOW()
    FROM jsonb_each($28::jsonb) AS auth_level(auth_id, auth_items)
    CROSS JOIN jsonb_each_text(auth_items) AS item_level(auth_item_id, value)
    WHERE auth_id IS NOT NULL AND auth_id != '' AND auth_item_id IS NOT NULL AND auth_item_id != ''
    ON CONFLICT (settings_id, auth_id, auth_item_id) DO UPDATE SET
        value = EXCLUDED.value,
        updated_at = NOW()
),
copy_setting_auth_values_fallback AS (
    -- Fallback: Copy setting_auth_values from old settings to new (if auth_value_mapping not provided)
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
copy_setting_default_account AS (
    -- Copy default admin account from old settings to new (if not provided)
    INSERT INTO settings_default_account (settings_id, profile_id, active, created_at, updated_at)
    SELECT 
        (SELECT settings_id FROM insert_new LIMIT 1)::uuid,
        sda.profile_id,
        CASE WHEN $24::text IS NULL OR $24::text = '' THEN sda.active ELSE false END,
        NOW(),
        NOW()
    FROM old_settings_id osi
    CROSS JOIN settings_default_account sda
    WHERE sda.settings_id = osi.old_id::uuid AND sda.active = true
      AND ($24::text IS NULL OR $24::text = '')
    ON CONFLICT (settings_id, profile_id) DO UPDATE SET
        active = EXCLUDED.active,
        updated_at = NOW()
),
copy_setting_default_guest AS (
    -- Copy default guest account from old settings to new (if not provided)
    INSERT INTO settings_default_guest (settings_id, profile_id, active, created_at, updated_at)
    SELECT 
        (SELECT settings_id FROM insert_new LIMIT 1)::uuid,
        sdg.profile_id,
        CASE WHEN $25::text IS NULL OR $25::text = '' THEN sdg.active ELSE false END,
        NOW(),
        NOW()
    FROM old_settings_id osi
    CROSS JOIN settings_default_guest sdg
    WHERE sdg.settings_id = osi.old_id::uuid AND sdg.active = true
      AND ($25::text IS NULL OR $25::text = '')
    ON CONFLICT (settings_id, profile_id) DO UPDATE SET
        active = EXCLUDED.active,
        updated_at = NOW()
),
apply_default_admin_account AS (
    -- Apply new default admin account (deactivate old, activate new)
    UPDATE settings_default_account
    SET active = false, updated_at = NOW()
    WHERE settings_id = (SELECT settings_id FROM insert_new LIMIT 1)::uuid
      AND ($24::text IS NOT NULL AND $24::text != '')
),
insert_default_admin_account AS (
    -- Insert new default admin account
    INSERT INTO settings_default_account (settings_id, profile_id, active, created_at, updated_at)
    SELECT 
        (SELECT settings_id FROM insert_new LIMIT 1)::uuid,
        $24::uuid,
        true,
        NOW(),
        NOW()
    WHERE $24::text IS NOT NULL AND $24::text != ''
    ON CONFLICT (settings_id, profile_id) DO UPDATE SET
        active = true,
        updated_at = NOW()
),
apply_default_guest_account AS (
    -- Apply new default guest account (deactivate old, activate new)
    UPDATE settings_default_guest
    SET active = false, updated_at = NOW()
    WHERE settings_id = (SELECT settings_id FROM insert_new LIMIT 1)::uuid
      AND ($25::text IS NOT NULL AND $25::text != '')
),
insert_default_guest_account AS (
    -- Insert new default guest account
    INSERT INTO settings_default_guest (settings_id, profile_id, active, created_at, updated_at)
    SELECT 
        (SELECT settings_id FROM insert_new LIMIT 1)::uuid,
        $25::uuid,
        true,
        NOW(),
        NOW()
    WHERE $25::text IS NOT NULL AND $25::text != ''
    ON CONFLICT (settings_id, profile_id) DO UPDATE SET
        active = true,
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
    FROM jsonb_each_text(COALESCE($22::jsonb, '{}'::jsonb)) AS t(provider_id, key_id)
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
    FROM jsonb_each(COALESCE($23::jsonb, '{}'::jsonb)) AS auth_entry(auth_id, items)
    CROSS JOIN jsonb_each_text(items) AS item_entry(auth_item_id, key_id)
    WHERE auth_id IS NOT NULL AND auth_item_id IS NOT NULL AND key_id IS NOT NULL
      AND auth_id != '' AND auth_item_id != '' AND key_id != ''
    ON CONFLICT (settings_id, auth_id, auth_item_id, key_id) DO UPDATE SET
        active = true,
        updated_at = NOW()
),
copy_department_settings AS (
    -- Copy department_settings links from old settings to new (if department_ids not provided)
    INSERT INTO department_settings (settings_id, department_id, active, created_at, updated_at)
    SELECT 
        (SELECT settings_id FROM insert_new LIMIT 1)::uuid,
        ds.department_id,
        ds.active,
        NOW(),
        NOW()
    FROM old_settings_id osi
    CROSS JOIN department_settings ds
    WHERE ds.settings_id = osi.old_id::uuid AND ds.active = true
      AND ($29::text[] IS NULL OR array_length($29::text[], 1) IS NULL)
    ON CONFLICT (settings_id, department_id) DO UPDATE SET
        active = EXCLUDED.active,
        updated_at = NOW()
),
replace_department_settings AS (
    -- Deactivate all existing department_settings links for the new settings
    UPDATE department_settings
    SET active = false, updated_at = NOW()
    WHERE settings_id = (SELECT settings_id FROM insert_new LIMIT 1)::uuid
      AND ($29::text[] IS NOT NULL AND array_length($29::text[], 1) IS NOT NULL)
),
link_department_settings AS (
    -- Insert new department_settings links based on department_ids array
    -- Empty array = global settings (no links), non-empty = department-specific
    INSERT INTO department_settings (settings_id, department_id, active, created_at, updated_at)
    SELECT 
        (SELECT settings_id FROM insert_new LIMIT 1)::uuid,
        dept_id::uuid,
        true,
        NOW(),
        NOW()
    FROM UNNEST($29::text[]) as dept_id
    WHERE $29::text[] IS NOT NULL AND array_length($29::text[], 1) > 0
    ON CONFLICT (settings_id, department_id) DO UPDATE SET
        active = true,
        updated_at = NOW()
)
SELECT settings_id FROM insert_new

