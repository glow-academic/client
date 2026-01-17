-- UPDATE setting_artifact: deactivate current active row, insert new active row
-- Converted to function with composite types (NO JSONB)
-- Uses safe drop/recreate pattern: drop function first, then types (no CASCADE), then recreate
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
    providers_id uuid,
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
    providers_id uuid,
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
        COALESCE((SELECT n.name FROM profile_names pn JOIN names_resource n ON pn.name_id = n.id WHERE pn.profile_id = p.id AND pn.type = 'first' LIMIT 1) || ' ' || (SELECT n2.name FROM profile_names pn2 JOIN names_resource n2 ON pn2.name_id = n2.id WHERE pn2.profile_id = p.id AND pn2.type = 'last' LIMIT 1), '') as actor_name
    FROM params x
    JOIN profile_artifact p ON p.id = x.profile_id
),
active_flag_id AS (
    -- Get the active flag ID
    SELECT id as flag_id FROM flags_resource WHERE name = 'active' LIMIT 1
),
old_settings_id AS (
    -- Capture old settings ID before deactivating (using setting_flags)
    SELECT s.id as old_id 
    FROM setting_artifact s
    JOIN setting_flags sf ON sf.setting_id = s.id
    JOIN flags_resource fl ON sf.flag_id = fl.id
    CROSS JOIN active_flag_id afi
    WHERE fl.name = 'active' 
      AND sf.value = TRUE
      AND sf.flag_id = afi.flag_id
    LIMIT 1
),
deactivate_current AS (
    -- Deactivate the current active settings row (update setting_flags)
    UPDATE setting_flags
    SET value = FALSE, updated_at = NOW()
    FROM flags_resource fl
    CROSS JOIN active_flag_id afi
    WHERE setting_flags.flag_id = fl.id
      AND fl.name = 'active'
      AND setting_flags.value = TRUE
      AND setting_flags.flag_id = afi.flag_id
),
get_or_create_name AS (
    -- Get or create name in names table
    INSERT INTO names_resource (name, created_at, updated_at)
    SELECT x.name, NOW(), NOW()
    FROM params x
    ON CONFLICT (name) DO UPDATE SET updated_at = NOW()
    RETURNING id as name_id, name as name_value
),
get_or_create_description AS (
    -- Get or create description in descriptions table
    INSERT INTO descriptions_resource (description, created_at, updated_at)
    SELECT x.description, NOW(), NOW()
    FROM params x
    WHERE x.description IS NOT NULL AND x.description != ''
    ON CONFLICT (description) DO UPDATE SET updated_at = NOW()
    RETURNING id as description_id
),
get_or_create_colors AS (
    -- Get or create colors in colors table for each color type
    INSERT INTO colors_resource (hex_code, created_at, updated_at)
    SELECT DISTINCT color_value, NOW(), NOW()
    FROM params x
    CROSS JOIN LATERAL (
        VALUES 
            ('primary', x.primary_color),
            ('accent', x.accent),
            ('background', x.background),
            ('surface', x.surface),
            ('success', x.success),
            ('warning', x.warning),
            ('error', x.error),
            ('sidebar_background', x.sidebar_background),
            ('sidebar_primary', x.sidebar_primary),
            ('chart1', x.chart1),
            ('chart2', x.chart2),
            ('chart3', x.chart3),
            ('chart4', x.chart4),
            ('chart5', x.chart5)
    ) AS color_types(color_type, color_value)
    WHERE color_value IS NOT NULL AND color_value != ''
    ON CONFLICT (hex_code) DO UPDATE SET updated_at = NOW()
    RETURNING id as color_id, hex_code
),
get_or_create_thresholds AS (
    -- Get or create thresholds in thresholds table for each threshold type
    INSERT INTO thresholds_resource (value, created_at, updated_at)
    SELECT DISTINCT threshold_value, NOW(), NOW()
    FROM params x
    CROSS JOIN LATERAL (
        VALUES 
            ('success', x.success_threshold),
            ('warning', x.warning_threshold),
            ('danger', x.danger_threshold)
    ) AS threshold_types(threshold_type, threshold_value)
    WHERE threshold_value IS NOT NULL
    ON CONFLICT (value) DO UPDATE SET updated_at = NOW()
    RETURNING id as threshold_id, value as threshold_value
),
get_guest_login_flag AS (
    -- Get the guest_login_enabled flag ID
    SELECT id as flag_id
    FROM flags_resource
    WHERE name = 'guest_login_enabled'
    LIMIT 1
),
insert_new AS (
    -- Insert new settings row (only id, created_at remain)
    INSERT INTO setting_artifact (created_at)
    SELECT NOW()
    FROM params
    RETURNING id as settings_id
),
link_name AS (
    -- Link name to settings
    INSERT INTO setting_names (setting_id, name_id, created_at, updated_at)
    SELECT ins.settings_id, gocn.name_id, NOW(), NOW()
    FROM insert_new ins
    CROSS JOIN get_or_create_name gocn
),
link_description AS (
    -- Link description to settings (if provided)
    INSERT INTO setting_descriptions (setting_id, description_id, created_at, updated_at)
    SELECT ins.settings_id, gocd.description_id, NOW(), NOW()
    FROM insert_new ins
    CROSS JOIN get_or_create_description gocd
    WHERE gocd.description_id IS NOT NULL
),
link_colors AS (
    -- Link colors to settings
    INSERT INTO setting_colors (setting_id, color_id, type, created_at, updated_at)
    SELECT ins.settings_id, gocc.color_id, color_type::type_setting_colors, NOW(), NOW()
    FROM insert_new ins
    CROSS JOIN params x
    CROSS JOIN LATERAL (
        VALUES 
            ('primary', x.primary_color),
            ('accent', x.accent),
            ('background', x.background),
            ('surface', x.surface),
            ('success', x.success),
            ('warning', x.warning),
            ('error', x.error),
            ('sidebar_background', x.sidebar_background),
            ('sidebar_primary', x.sidebar_primary),
            ('chart1', x.chart1),
            ('chart2', x.chart2),
            ('chart3', x.chart3),
            ('chart4', x.chart4),
            ('chart5', x.chart5)
    ) AS color_types(color_type, color_value)
    JOIN get_or_create_colors gocc ON gocc.hex_code = color_value
    WHERE color_value IS NOT NULL AND color_value != ''
    ON CONFLICT (setting_id, color_id, type) DO UPDATE SET updated_at = NOW()
),
link_thresholds AS (
    -- Link thresholds to settings
    INSERT INTO setting_thresholds (setting_id, threshold_id, type, created_at, updated_at)
    SELECT ins.settings_id, goct.threshold_id, threshold_type::type_setting_thresholds, NOW(), NOW()
    FROM insert_new ins
    CROSS JOIN params x
    CROSS JOIN LATERAL (
        VALUES 
            ('success', x.success_threshold),
            ('warning', x.warning_threshold),
            ('danger', x.danger_threshold)
    ) AS threshold_types(threshold_type, threshold_value)
    JOIN get_or_create_thresholds goct ON goct.threshold_value = threshold_types.threshold_value
    WHERE threshold_types.threshold_value IS NOT NULL
    ON CONFLICT (setting_id, threshold_id, type) DO UPDATE SET updated_at = NOW()
),
link_guest_login_flag AS (
    -- Link guest_login_enabled flag to settings
    INSERT INTO setting_flags (setting_id, flag_id, value, created_at, updated_at) SELECT ins.settings_id, glf.flag_id, x.guest_login_enabled, NOW(), NOW()
    FROM insert_new ins
    CROSS JOIN get_guest_login_flag glf
    CROSS JOIN params x
    ON CONFLICT (setting_id, flag_id) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
),
settings_with_name AS (
    -- Get settings_id and name for RETURNING clause
    SELECT ins.settings_id, gocn.name_value as settings_name
    FROM insert_new ins
    CROSS JOIN get_or_create_name gocn
),
manage_setting_providers AS (
    -- Manage provider links based on provider_enabled array
    INSERT INTO setting_providers (settings_id, providers_id, active, created_at, updated_at)
    SELECT 
        (SELECT settings_id FROM insert_new LIMIT 1),
        pe.providers_id,
        pe.enabled,
        NOW(),
        NOW()
    FROM params x
    CROSS JOIN UNNEST(x.provider_enabled) AS pe
    WHERE array_length(x.provider_enabled, 1) > 0
    ON CONFLICT (settings_id, providers_id) DO UPDATE SET
        active = EXCLUDED.active,
        updated_at = NOW()
),
copy_setting_providers_fallback AS (
    -- Fallback: Copy setting_providers links from old settings to new (if provider_enabled not provided)
    INSERT INTO setting_providers (settings_id, providers_id, active, created_at, updated_at)
    SELECT 
        (SELECT settings_id FROM insert_new LIMIT 1),
        sp.providers_id,
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
          WHERE pe.providers_id = sp.providers_id
      )
    ON CONFLICT (settings_id, providers_id) DO UPDATE SET
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
old_admin_account_data AS (
    -- Get admin account data from old settings
    SELECT 
        dar_old.profile_id,
        dar_old.active,
        dar_old.generated,
        dar_old.mcp,
        dar_old.call_id,
        dar_old.group_id,
        sda_old.active as junction_active
    FROM old_settings_id osi
    JOIN setting_default_accounts sda_old ON sda_old.setting_id = osi.old_id
    JOIN default_accounts_resource dar_old ON dar_old.id = sda_old.default_account_id
    JOIN params x ON x.default_admin_profile_id IS NULL
    WHERE dar_old.type = 'admin'::default_account_type AND sda_old.active = true
    LIMIT 1
),
find_existing_admin_resource AS (
    SELECT dar_existing.id as default_account_id, oaad.junction_active, oaad.generated, oaad.mcp
    FROM old_admin_account_data oaad
    LEFT JOIN default_accounts_resource dar_existing ON dar_existing.profile_id = oaad.profile_id 
        AND dar_existing.type = 'admin'::default_account_type
),
create_admin_resource_if_needed AS (
    INSERT INTO default_accounts_resource (profile_id, type, active, generated, mcp, call_id, group_id, created_at, updated_at)
    SELECT oaad.profile_id, 'admin'::default_account_type, oaad.active, oaad.generated, oaad.mcp, oaad.call_id, oaad.group_id, NOW(), NOW()
    FROM old_admin_account_data oaad
    WHERE NOT EXISTS (SELECT 1 FROM find_existing_admin_resource WHERE default_account_id IS NOT NULL)
    RETURNING id as default_account_id
),
get_admin_resource_id AS (
    SELECT COALESCE(fear.default_account_id, car.default_account_id) as default_account_id,
           COALESCE(fear.junction_active, oaad.junction_active) as junction_active,
           COALESCE(fear.generated, oaad.generated) as generated,
           COALESCE(fear.mcp, oaad.mcp) as mcp
    FROM old_admin_account_data oaad
    LEFT JOIN find_existing_admin_resource fear ON true
    LEFT JOIN create_admin_resource_if_needed car ON true
    LIMIT 1
),
copy_setting_default_account AS (
    INSERT INTO setting_default_accounts (setting_id, default_account_id, active, created_at, updated_at, generated, mcp)
    SELECT (SELECT settings_id FROM insert_new LIMIT 1), garid.default_account_id,
           CASE WHEN (SELECT default_admin_profile_id FROM params) IS NULL THEN garid.junction_active ELSE false END,
           NOW(), NOW(), garid.generated, garid.mcp
    FROM get_admin_resource_id garid
    WHERE garid.default_account_id IS NOT NULL
    ON CONFLICT (setting_id, default_account_id) DO UPDATE SET active = EXCLUDED.active, updated_at = NOW()
),
old_guest_account_data AS (
    SELECT dar_old.profile_id, dar_old.active, dar_old.generated, dar_old.mcp, dar_old.call_id, dar_old.group_id, sda_old.active as junction_active
    FROM old_settings_id osi
    JOIN setting_default_accounts sda_old ON sda_old.setting_id = osi.old_id
    JOIN default_accounts_resource dar_old ON dar_old.id = sda_old.default_account_id
    JOIN params x ON x.default_guest_profile_id IS NULL
    WHERE dar_old.type = 'guest'::default_account_type AND sda_old.active = true
    LIMIT 1
),
find_existing_guest_resource AS (
    SELECT dar_existing.id as default_account_id, ogad.junction_active, ogad.generated, ogad.mcp
    FROM old_guest_account_data ogad
    LEFT JOIN default_accounts_resource dar_existing ON dar_existing.profile_id = ogad.profile_id 
        AND dar_existing.type = 'guest'::default_account_type
),
create_guest_resource_if_needed AS (
    INSERT INTO default_accounts_resource (profile_id, type, active, generated, mcp, call_id, group_id, created_at, updated_at)
    SELECT ogad.profile_id, 'guest'::default_account_type, ogad.active, ogad.generated, ogad.mcp, ogad.call_id, ogad.group_id, NOW(), NOW()
    FROM old_guest_account_data ogad
    WHERE NOT EXISTS (SELECT 1 FROM find_existing_guest_resource WHERE default_account_id IS NOT NULL)
    RETURNING id as default_account_id
),
get_guest_resource_id AS (
    SELECT COALESCE(fegr.default_account_id, cgr.default_account_id) as default_account_id,
           COALESCE(fegr.junction_active, ogad.junction_active) as junction_active,
           COALESCE(fegr.generated, ogad.generated) as generated,
           COALESCE(fegr.mcp, ogad.mcp) as mcp
    FROM old_guest_account_data ogad
    LEFT JOIN find_existing_guest_resource fegr ON true
    LEFT JOIN create_guest_resource_if_needed cgr ON true
    LIMIT 1
),
copy_setting_default_guest AS (
    INSERT INTO setting_default_accounts (setting_id, default_account_id, active, created_at, updated_at, generated, mcp)
    SELECT (SELECT settings_id FROM insert_new LIMIT 1), grid.default_account_id,
           CASE WHEN (SELECT default_guest_profile_id FROM params) IS NULL THEN grid.junction_active ELSE false END,
           NOW(), NOW(), grid.generated, grid.mcp
    FROM get_guest_resource_id grid
    WHERE grid.default_account_id IS NOT NULL
    ON CONFLICT (setting_id, default_account_id) DO UPDATE SET active = EXCLUDED.active, updated_at = NOW()
),
apply_default_admin_account AS (
    -- Apply new default admin account (deactivate old, activate new)
    UPDATE setting_default_accounts
    SET active = false, updated_at = NOW()
    WHERE setting_id = (SELECT settings_id FROM insert_new LIMIT 1)
      AND default_account_id IN (
          SELECT dar.id FROM default_accounts_resource dar
          WHERE dar.type = 'admin'::default_account_type
      )
      AND (SELECT default_admin_profile_id FROM params) IS NOT NULL
),
new_admin_account_data AS (
    -- Get new admin account profile_id from params
    SELECT 
        x.default_admin_profile_id as profile_id,
        (SELECT group_id FROM setting_artifact WHERE id = (SELECT settings_id FROM insert_new LIMIT 1)) as group_id
    FROM params x
    WHERE x.default_admin_profile_id IS NOT NULL
    LIMIT 1
),
find_existing_new_admin_resource AS (
    -- Try to find existing default_accounts_resource
    SELECT 
        dar_existing.id as default_account_id
    FROM new_admin_account_data naad
    LEFT JOIN default_accounts_resource dar_existing ON dar_existing.profile_id = naad.profile_id 
        AND dar_existing.type = 'admin'::default_account_type
),
create_new_admin_resource_if_needed AS (
    -- Create default_accounts_resource if it doesn't exist
    INSERT INTO default_accounts_resource (profile_id, type, active, generated, mcp, call_id, group_id, created_at, updated_at)
    SELECT 
        naad.profile_id,
        'admin'::default_account_type,
        true,
        false,
        false,
        (SELECT id FROM calls LIMIT 1), -- Placeholder call_id
        naad.group_id,
        NOW(),
        NOW()
    FROM new_admin_account_data naad
    WHERE NOT EXISTS (SELECT 1 FROM find_existing_new_admin_resource WHERE default_account_id IS NOT NULL)
    RETURNING id as default_account_id
),
get_new_admin_resource_id AS (
    -- Get the resource ID (either existing or newly created)
    SELECT 
        COALESCE(fenar.default_account_id, cnar.default_account_id) as default_account_id
    FROM new_admin_account_data naad
    LEFT JOIN find_existing_new_admin_resource fenar ON true
    LEFT JOIN create_new_admin_resource_if_needed cnar ON true
    LIMIT 1
),
insert_default_admin_account AS (
    -- Insert new default admin account
    INSERT INTO setting_default_accounts (setting_id, default_account_id, active, created_at, updated_at, generated, mcp)
    SELECT 
        (SELECT settings_id FROM insert_new LIMIT 1),
        gnari.default_account_id,
        true,
        NOW(),
        NOW(),
        false,
        false
    FROM get_new_admin_resource_id gnari
    WHERE gnari.default_account_id IS NOT NULL
    ON CONFLICT (setting_id, default_account_id) DO UPDATE SET
        active = true,
        updated_at = NOW()
),
apply_default_guest_account AS (
    -- Apply new default guest account (deactivate old, activate new)
    UPDATE setting_default_accounts
    SET active = false, updated_at = NOW()
    WHERE setting_id = (SELECT settings_id FROM insert_new LIMIT 1)
      AND default_account_id IN (
          SELECT dar.id FROM default_accounts_resource dar
          WHERE dar.type = 'guest'::default_account_type
      )
      AND (SELECT default_guest_profile_id FROM params) IS NOT NULL
),
new_guest_account_data AS (
    -- Get new guest account profile_id from params
    SELECT 
        x.default_guest_profile_id as profile_id,
        (SELECT group_id FROM setting_artifact WHERE id = (SELECT settings_id FROM insert_new LIMIT 1)) as group_id
    FROM params x
    WHERE x.default_guest_profile_id IS NOT NULL
    LIMIT 1
),
find_existing_new_guest_resource AS (
    -- Try to find existing default_accounts_resource
    SELECT 
        dar_existing.id as default_account_id
    FROM new_guest_account_data ngad
    LEFT JOIN default_accounts_resource dar_existing ON dar_existing.profile_id = ngad.profile_id 
        AND dar_existing.type = 'guest'::default_account_type
),
create_new_guest_resource_if_needed AS (
    -- Create default_accounts_resource if it doesn't exist
    INSERT INTO default_accounts_resource (profile_id, type, active, generated, mcp, call_id, group_id, created_at, updated_at)
    SELECT 
        ngad.profile_id,
        'guest'::default_account_type,
        true,
        false,
        false,
        (SELECT id FROM calls LIMIT 1), -- Placeholder call_id
        ngad.group_id,
        NOW(),
        NOW()
    FROM new_guest_account_data ngad
    WHERE NOT EXISTS (SELECT 1 FROM find_existing_new_guest_resource WHERE default_account_id IS NOT NULL)
    RETURNING id as default_account_id
),
get_new_guest_resource_id AS (
    -- Get the resource ID (either existing or newly created)
    SELECT 
        COALESCE(fengr.default_account_id, cngr.default_account_id) as default_account_id
    FROM new_guest_account_data ngad
    LEFT JOIN find_existing_new_guest_resource fengr ON true
    LEFT JOIN create_new_guest_resource_if_needed cngr ON true
    LIMIT 1
),
insert_default_guest_account AS (
    -- Insert new default guest account
    INSERT INTO setting_default_accounts (setting_id, default_account_id, active, created_at, updated_at, generated, mcp)
    SELECT 
        (SELECT settings_id FROM insert_new LIMIT 1),
        gngri.default_account_id,
        true,
        NOW(),
        NOW(),
        false,
        false
    FROM get_new_guest_resource_id gngri
    WHERE gngri.default_account_id IS NOT NULL
    ON CONFLICT (setting_id, default_account_id) DO UPDATE SET
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
    INSERT INTO setting_provider_keys (settings_id, providers_id, key_id, active, created_at, updated_at)
    SELECT 
        (SELECT settings_id FROM insert_new LIMIT 1),
        pk.providers_id,
        pk.key_id,
        true,
        NOW(),
        NOW()
    FROM params x
    CROSS JOIN UNNEST(x.provider_keys) AS pk
    WHERE array_length(x.provider_keys, 1) > 0
    ON CONFLICT (settings_id, providers_id, key_id) DO UPDATE SET
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
),
activate_new_settings AS (
    -- Activate the new settings row by inserting into setting_flags
    INSERT INTO setting_flags (setting_id, flag_id, value, created_at, updated_at)
    SELECT 
        (SELECT settings_id FROM insert_new LIMIT 1),
        afi.flag_id,
        TRUE,
        NOW(),
        NOW()
    FROM active_flag_id afi
    ON CONFLICT (setting_id, flag_id) DO UPDATE SET
        value = TRUE,
        updated_at = NOW()
)
SELECT 
    swn.settings_id,
    swn.settings_name,
    ap.actor_name
FROM settings_with_name swn
CROSS JOIN actor_profile ap
$$;