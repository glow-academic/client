-- Update settings: deactivate current active row, insert new active row
-- Converted to function with composite types (NO JSONB)
-- Uses safe drop/recreate pattern: drop function first, then types (no CASCADE), then recreate

BEGIN;

-- 1) Drop function first (breaks dependency on types)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'api_update_settings_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_update_settings_v4(%s)', r.sig);
    END LOOP;
END $$;

-- 2) Drop types WITHOUT CASCADE
-- Drop parent types first, then child types (reverse dependency order)
DO $$
DECLARE
    r RECORD;
    type_order text[] := ARRAY[
        'i_update_settings_v4_auth_key',
        'i_update_settings_v4_auth_value',
        'i_update_settings_v4_auth_key_item',
        'i_update_settings_v4_auth_value_item',
        'i_update_settings_v4_provider_key',
        'i_update_settings_v4_provider_enabled',
        'i_update_settings_v4_auth_enabled'
    ];
    type_name text;
BEGIN
    -- Drop in reverse dependency order (parents before children)
    FOREACH type_name IN ARRAY type_order
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I', type_name);
    END LOOP;
    
    -- Drop any remaining types matching the pattern (safety net)
    FOR r IN 
        SELECT typname 
        FROM pg_type 
        WHERE typname LIKE 'i_update_settings_v4_%'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        BEGIN
            EXECUTE format('DROP TYPE IF EXISTS types.%I', r.typname);
        EXCEPTION WHEN OTHERS THEN
            -- Type might have dependencies, skip it
            NULL;
        END;
    END LOOP;
END $$;

-- 3) Recreate types
-- Input types for update
CREATE TYPE types.i_update_settings_v4_provider_key AS (
    provider_id uuid,
    key_id uuid
);

CREATE TYPE types.i_update_settings_v4_auth_key_item AS (
    auth_item_id uuid,
    key_id uuid
);

CREATE TYPE types.i_update_settings_v4_auth_key AS (
    auth_id uuid,
    items types.i_update_settings_v4_auth_key_item[]
);

CREATE TYPE types.i_update_settings_v4_provider_enabled AS (
    provider_id uuid,
    enabled boolean
);

CREATE TYPE types.i_update_settings_v4_auth_enabled AS (
    auth_id uuid,
    enabled boolean
);

CREATE TYPE types.i_update_settings_v4_auth_value_item AS (
    auth_item_id uuid,
    value text
);

CREATE TYPE types.i_update_settings_v4_auth_value AS (
    auth_id uuid,
    items types.i_update_settings_v4_auth_value_item[]
);

-- 4) Recreate function
CREATE OR REPLACE FUNCTION api_update_settings_v4(
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
    profile_id uuid,
    provider_keys types.i_update_settings_v4_provider_key[] DEFAULT ARRAY[]::types.i_update_settings_v4_provider_key[],
    auth_keys types.i_update_settings_v4_auth_key[] DEFAULT ARRAY[]::types.i_update_settings_v4_auth_key[],
    default_admin_profile_id uuid DEFAULT NULL,
    default_guest_profile_id uuid DEFAULT NULL,
    provider_enabled types.i_update_settings_v4_provider_enabled[] DEFAULT ARRAY[]::types.i_update_settings_v4_provider_enabled[],
    auth_enabled types.i_update_settings_v4_auth_enabled[] DEFAULT ARRAY[]::types.i_update_settings_v4_auth_enabled[],
    auth_values types.i_update_settings_v4_auth_value[] DEFAULT ARRAY[]::types.i_update_settings_v4_auth_value[],
    department_ids uuid[] DEFAULT ARRAY[]::uuid[]
)
RETURNS TABLE (
    settings_id uuid,
    settings_name text,
    actor_name text
)
LANGUAGE sql
VOLATILE
AS $$
WITH params AS (
    SELECT 
        name AS name,
        description AS description,
        primary_color AS primary_color,
        accent AS accent,
        background AS background,
        surface AS surface,
        success AS success,
        warning AS warning,
        error AS error,
        sidebar_background AS sidebar_background,
        sidebar_primary AS sidebar_primary,
        chart1 AS chart1,
        chart2 AS chart2,
        chart3 AS chart3,
        chart4 AS chart4,
        chart5 AS chart5,
        guest_login_enabled AS guest_login_enabled,
        success_threshold AS success_threshold,
        warning_threshold AS warning_threshold,
        danger_threshold AS danger_threshold,
        profile_id AS profile_id,
        provider_keys AS provider_keys,
        auth_keys AS auth_keys,
        default_admin_profile_id AS default_admin_profile_id,
        default_guest_profile_id AS default_guest_profile_id,
        provider_enabled AS provider_enabled,
        auth_enabled AS auth_enabled,
        auth_values AS auth_values,
        COALESCE(department_ids, ARRAY[]::uuid[]) AS department_ids
),
actor_profile AS (
    SELECT
        p.id as profile_id,
        p.first_name || ' ' || p.last_name as actor_name
    FROM params x
    JOIN profiles p ON p.id = x.profile_id
),
old_settings_id AS (
    -- Capture old settings ID before deactivating
    SELECT id as old_id FROM settings WHERE active = true LIMIT 1
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
    SELECT 
        true,
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
    FROM params
    RETURNING id as settings_id, name as settings_name
),
manage_setting_providers AS (
    -- Manage provider links based on provider_enabled array
    INSERT INTO setting_providers (settings_id, provider_id, active, created_at, updated_at)
    SELECT 
        (SELECT settings_id FROM insert_new LIMIT 1),
        pe.provider_id,
        pe.enabled,
        NOW(),
        NOW()
    FROM params x
    CROSS JOIN UNNEST(x.provider_enabled) AS pe
    WHERE array_length(x.provider_enabled, 1) > 0
    ON CONFLICT (settings_id, provider_id) DO UPDATE SET
        active = EXCLUDED.active,
        updated_at = NOW()
),
copy_setting_providers_fallback AS (
    -- Fallback: Copy setting_providers links from old settings to new (if provider_enabled not provided)
    INSERT INTO setting_providers (settings_id, provider_id, active, created_at, updated_at)
    SELECT 
        (SELECT settings_id FROM insert_new LIMIT 1),
        sp.provider_id,
        sp.active,
        NOW(),
        NOW()
    FROM old_settings_id osi
    CROSS JOIN setting_providers sp
    JOIN params x ON array_length(x.provider_enabled, 1) IS NULL
    WHERE sp.settings_id = osi.old_id AND sp.active = true
      AND NOT EXISTS (
          SELECT 1 FROM params x2
          CROSS JOIN UNNEST(x2.provider_enabled) AS pe
          WHERE pe.provider_id = sp.provider_id
      )
    ON CONFLICT (settings_id, provider_id) DO UPDATE SET
        active = COALESCE(EXCLUDED.active, setting_providers.active),
        updated_at = NOW()
),
manage_setting_auths AS (
    -- Manage auth links based on auth_enabled array
    INSERT INTO setting_auths (settings_id, auth_id, active, created_at, updated_at)
    SELECT 
        (SELECT settings_id FROM insert_new LIMIT 1),
        ae.auth_id,
        ae.enabled,
        NOW(),
        NOW()
    FROM params x
    CROSS JOIN UNNEST(x.auth_enabled) AS ae
    WHERE array_length(x.auth_enabled, 1) > 0
    ON CONFLICT (settings_id, auth_id) DO UPDATE SET
        active = EXCLUDED.active,
        updated_at = NOW()
),
copy_setting_auths_fallback AS (
    -- Fallback: Copy setting_auths links from old settings to new (if auth_enabled not provided)
    INSERT INTO setting_auths (settings_id, auth_id, active, created_at, updated_at)
    SELECT 
        (SELECT settings_id FROM insert_new LIMIT 1),
        sa.auth_id,
        sa.active,
        NOW(),
        NOW()
    FROM old_settings_id osi
    CROSS JOIN setting_auths sa
    JOIN params x ON array_length(x.auth_enabled, 1) IS NULL
    WHERE sa.settings_id = osi.old_id AND sa.active = true
      AND NOT EXISTS (
          SELECT 1 FROM params x2
          CROSS JOIN UNNEST(x2.auth_enabled) AS ae
          WHERE ae.auth_id = sa.auth_id
      )
    ON CONFLICT (settings_id, auth_id) DO UPDATE SET
        active = COALESCE(EXCLUDED.active, setting_auths.active),
        updated_at = NOW()
),
manage_setting_auth_values AS (
    -- Manage auth values based on auth_values array (for non-encrypted items)
    INSERT INTO setting_auth_values (settings_id, auth_id, auth_item_id, value, created_at, updated_at)
    SELECT 
        (SELECT settings_id FROM insert_new LIMIT 1),
        av.auth_id,
        avi.auth_item_id,
        avi.value,
        NOW(),
        NOW()
    FROM params x
    CROSS JOIN UNNEST(x.auth_values) AS av
    CROSS JOIN UNNEST(av.items) AS avi
    WHERE array_length(x.auth_values, 1) > 0
    ON CONFLICT (settings_id, auth_id, auth_item_id) DO UPDATE SET
        value = EXCLUDED.value,
        updated_at = NOW()
),
copy_setting_auth_values_fallback AS (
    -- Fallback: Copy setting_auth_values from old settings to new (if auth_values not provided)
    INSERT INTO setting_auth_values (settings_id, auth_id, auth_item_id, value, created_at, updated_at)
    SELECT 
        (SELECT settings_id FROM insert_new LIMIT 1),
        sav.auth_id,
        sav.auth_item_id,
        sav.value,
        NOW(),
        NOW()
    FROM old_settings_id osi
    CROSS JOIN setting_auth_values sav
    JOIN params x ON array_length(x.auth_values, 1) IS NULL
    WHERE sav.settings_id = osi.old_id
    ON CONFLICT (settings_id, auth_id, auth_item_id) DO UPDATE SET
        value = EXCLUDED.value,
        updated_at = NOW()
),
copy_setting_default_account AS (
    -- Copy default admin account from old settings to new (if not provided)
    INSERT INTO settings_default_account (settings_id, profile_id, active, created_at, updated_at)
    SELECT 
        (SELECT settings_id FROM insert_new LIMIT 1),
        sda.profile_id,
        CASE WHEN (SELECT default_admin_profile_id FROM params) IS NULL THEN sda.active ELSE false END,
        NOW(),
        NOW()
    FROM old_settings_id osi
    CROSS JOIN settings_default_account sda
    JOIN params x ON x.default_admin_profile_id IS NULL
    WHERE sda.settings_id = osi.old_id AND sda.active = true
    ON CONFLICT (settings_id, profile_id) DO UPDATE SET
        active = EXCLUDED.active,
        updated_at = NOW()
),
copy_setting_default_guest AS (
    -- Copy default guest account from old settings to new (if not provided)
    INSERT INTO settings_default_guest (settings_id, profile_id, active, created_at, updated_at)
    SELECT 
        (SELECT settings_id FROM insert_new LIMIT 1),
        sdg.profile_id,
        CASE WHEN (SELECT default_guest_profile_id FROM params) IS NULL THEN sdg.active ELSE false END,
        NOW(),
        NOW()
    FROM old_settings_id osi
    CROSS JOIN settings_default_guest sdg
    JOIN params x ON x.default_guest_profile_id IS NULL
    WHERE sdg.settings_id = osi.old_id AND sdg.active = true
    ON CONFLICT (settings_id, profile_id) DO UPDATE SET
        active = EXCLUDED.active,
        updated_at = NOW()
),
apply_default_admin_account AS (
    -- Apply new default admin account (deactivate old, activate new)
    UPDATE settings_default_account
    SET active = false, updated_at = NOW()
    WHERE settings_id = (SELECT settings_id FROM insert_new LIMIT 1)
      AND (SELECT default_admin_profile_id FROM params) IS NOT NULL
),
insert_default_admin_account AS (
    -- Insert new default admin account
    INSERT INTO settings_default_account (settings_id, profile_id, active, created_at, updated_at)
    SELECT 
        (SELECT settings_id FROM insert_new LIMIT 1),
        default_admin_profile_id,
        true,
        NOW(),
        NOW()
    FROM params
    WHERE default_admin_profile_id IS NOT NULL
    ON CONFLICT (settings_id, profile_id) DO UPDATE SET
        active = true,
        updated_at = NOW()
),
apply_default_guest_account AS (
    -- Apply new default guest account (deactivate old, activate new)
    UPDATE settings_default_guest
    SET active = false, updated_at = NOW()
    WHERE settings_id = (SELECT settings_id FROM insert_new LIMIT 1)
      AND (SELECT default_guest_profile_id FROM params) IS NOT NULL
),
insert_default_guest_account AS (
    -- Insert new default guest account
    INSERT INTO settings_default_guest (settings_id, profile_id, active, created_at, updated_at)
    SELECT 
        (SELECT settings_id FROM insert_new LIMIT 1),
        default_guest_profile_id,
        true,
        NOW(),
        NOW()
    FROM params
    WHERE default_guest_profile_id IS NOT NULL
    ON CONFLICT (settings_id, profile_id) DO UPDATE SET
        active = true,
        updated_at = NOW()
),
apply_provider_keys AS (
    -- Apply new provider key mappings
    -- First deactivate all existing provider keys for this settings
    UPDATE setting_provider_keys
    SET active = false, updated_at = NOW()
    WHERE settings_id = (SELECT settings_id FROM insert_new LIMIT 1)
),
insert_provider_keys AS (
    -- Insert new provider key mappings
    INSERT INTO setting_provider_keys (settings_id, provider_id, key_id, active, created_at, updated_at)
    SELECT 
        (SELECT settings_id FROM insert_new LIMIT 1),
        pk.provider_id,
        pk.key_id,
        true,
        NOW(),
        NOW()
    FROM params x
    CROSS JOIN UNNEST(x.provider_keys) AS pk
    WHERE array_length(x.provider_keys, 1) > 0
    ON CONFLICT (settings_id, provider_id, key_id) DO UPDATE SET
        active = true,
        updated_at = NOW()
),
apply_auth_keys AS (
    -- Apply new auth key mappings (auth_id -> auth_item_id -> key_id)
    -- First deactivate all existing auth keys for this settings
    UPDATE setting_auth_keys
    SET active = false, updated_at = NOW()
    WHERE settings_id = (SELECT settings_id FROM insert_new LIMIT 1)
),
insert_auth_keys AS (
    -- Insert new auth key mappings
    INSERT INTO setting_auth_keys (settings_id, auth_id, auth_item_id, key_id, active, created_at, updated_at)
    SELECT 
        (SELECT settings_id FROM insert_new LIMIT 1),
        ak.auth_id,
        aki.auth_item_id,
        aki.key_id,
        true,
        NOW(),
        NOW()
    FROM params x
    CROSS JOIN UNNEST(x.auth_keys) AS ak
    CROSS JOIN UNNEST(ak.items) AS aki
    WHERE array_length(x.auth_keys, 1) > 0
    ON CONFLICT (settings_id, auth_id, auth_item_id, key_id) DO UPDATE SET
        active = true,
        updated_at = NOW()
),
copy_department_settings AS (
    -- Copy department_settings links from old settings to new (if department_ids not provided)
    INSERT INTO department_settings (settings_id, department_id, active, created_at, updated_at)
    SELECT 
        (SELECT settings_id FROM insert_new LIMIT 1),
        ds.department_id,
        ds.active,
        NOW(),
        NOW()
    FROM old_settings_id osi
    CROSS JOIN department_settings ds
    JOIN params x ON array_length(x.department_ids, 1) IS NULL
    WHERE ds.settings_id = osi.old_id AND ds.active = true
    ON CONFLICT (settings_id, department_id) DO UPDATE SET
        active = EXCLUDED.active,
        updated_at = NOW()
),
replace_department_settings AS (
    -- Deactivate all existing department_settings links for the new settings
    UPDATE department_settings
    SET active = false, updated_at = NOW()
    WHERE settings_id = (SELECT settings_id FROM insert_new LIMIT 1)
      AND (SELECT array_length(department_ids, 1) FROM params) IS NOT NULL
),
link_department_settings AS (
    -- Insert new department_settings links based on department_ids array
    -- Empty array = global settings (no links), non-empty = department-specific
    INSERT INTO department_settings (settings_id, department_id, active, created_at, updated_at)
    SELECT 
        (SELECT settings_id FROM insert_new LIMIT 1),
        dept_id,
        true,
        NOW(),
        NOW()
    FROM params x
    CROSS JOIN UNNEST(x.department_ids) AS dept_id
    WHERE array_length(x.department_ids, 1) > 0
    ON CONFLICT (settings_id, department_id) DO UPDATE SET
        active = true,
        updated_at = NOW()
)
SELECT 
    in_new.settings_id,
    in_new.settings_name,
    ap.actor_name
FROM insert_new in_new
CROSS JOIN actor_profile ap
$$;

COMMIT;

