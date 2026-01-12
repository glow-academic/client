-- Get settings detail by ID with auth and provider info
-- Converted to function with composite types (NO JSONB)
-- Uses safe drop/recreate pattern: drop function first, then types (no CASCADE), then recreate
-- 1) Drop functions that depend on these types first
-- Drop active endpoint function first (depends on detail types)
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

-- Drop detail endpoint function
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'api_get_settings_detail_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_settings_detail_v4(%s)', r.sig);
    END LOOP;
END $$;

-- 2) Drop types WITHOUT CASCADE
-- Drop parent types first, then child types (reverse dependency order)
DO $$
DECLARE
    r RECORD;
    type_order text[] := ARRAY[
        'q_get_settings_detail_v4_auth',
        'q_get_settings_detail_v4_provider',
        'q_get_settings_detail_v4_provider_key',
        'q_get_settings_detail_v4_auth_key',
        'q_get_settings_detail_v4_auth_value',
        'q_get_settings_detail_v4_auth_item',
        'q_get_settings_detail_v4_auth_key_item',
        'q_get_settings_detail_v4_auth_value_item'
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
        WHERE typname LIKE 'q_get_settings_detail_v4_%'
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
-- Auth item (for nested auth_items)
CREATE TYPE types.q_get_settings_detail_v4_auth_item AS (
    auth_item_id uuid,
    name text,
    description text,
    encrypted boolean
);

-- Auth (with nested items)
CREATE TYPE types.q_get_settings_detail_v4_auth AS (
    auth_id uuid,
    name text,
    description text,
    slug text,
    active boolean,
    auth_items types.q_get_settings_detail_v4_auth_item[]
);

-- Provider
CREATE TYPE types.q_get_settings_detail_v4_provider AS (
    provider_id text,
    name text,
    description text,
    value text,
    active boolean
);

-- Provider key mapping
CREATE TYPE types.q_get_settings_detail_v4_provider_key AS (
    provider_id text,
    key_id uuid
);

-- Auth key mapping (nested)
CREATE TYPE types.q_get_settings_detail_v4_auth_key_item AS (
    auth_item_id uuid,
    key_id uuid
);

CREATE TYPE types.q_get_settings_detail_v4_auth_key AS (
    auth_id uuid,
    items types.q_get_settings_detail_v4_auth_key_item[]
);

-- Auth value mapping (nested)
CREATE TYPE types.q_get_settings_detail_v4_auth_value_item AS (
    auth_item_id uuid,
    value text
);

CREATE TYPE types.q_get_settings_detail_v4_auth_value AS (
    auth_id uuid,
    items types.q_get_settings_detail_v4_auth_value_item[]
);

-- Key (for keys array)
CREATE TYPE types.q_get_settings_detail_v4_key AS (
    key_id uuid,
    name text,
    key_masked text,
    description text,
    active boolean,
    department_ids text[]
);

-- 4) Recreate function
CREATE OR REPLACE FUNCTION api_get_settings_detail_v4(
    settings_id uuid,
    profile_id uuid,
    draft_id uuid DEFAULT NULL
)
RETURNS TABLE (
    settings_exists boolean,
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
    provider_keys types.q_get_settings_detail_v4_provider_key[],
    auth_keys types.q_get_settings_detail_v4_auth_key[],
    auth_values types.q_get_settings_detail_v4_auth_value[],
    keys types.q_get_settings_detail_v4_key[],
    all_providers types.q_get_settings_detail_v4_provider[],
    all_auths types.q_get_settings_detail_v4_auth[],
    default_admin_profile_id uuid,
    default_admin_name text,
    default_guest_profile_id uuid,
    default_guest_name text,
    department_ids text[],
    actor_name text,
    draft_version integer,
    provider_key_mapping jsonb,
    auth_key_mapping jsonb,
    provider_enabled jsonb,
    auth_enabled jsonb,
    auth_value_mapping jsonb
)
LANGUAGE sql
STABLE
AS $$
WITH params AS (
    SELECT 
        settings_id AS settings_id, 
        profile_id AS profile_id,
        draft_id AS draft_id
),
draft_payload_data AS (
    SELECT 
        NULL::jsonb as payload,
        d.version as draft_version
    FROM params x
    JOIN drafts d ON d.id = x.draft_id
    WHERE x.draft_id IS NOT NULL
    AND d.profile_id = x.profile_id
    
    LIMIT 1
),
settings_exists_check AS (
    SELECT EXISTS(
        SELECT 1 FROM setting WHERE id = (SELECT settings_id FROM params)
    )::boolean as settings_exists
),
user_profile AS (
    SELECT 
        COALESCE(COALESCE((SELECT n.name FROM profile_names pn JOIN names n ON pn.name_id = n.id WHERE pn.profile_id = p.id AND pn.type = 'first' LIMIT 1) || ' ' || (SELECT n2.name FROM profile_names pn2 JOIN names n2 ON pn2.name_id = n2.id WHERE pn2.profile_id = p.id AND pn2.type = 'last' LIMIT 1), ''), 'System') as actor_name
    FROM params x
    JOIN profile p ON p.id = x.profile_id
),
settings_auths_with_items AS (
    -- Get linked auths for this settings with nested auth_items
    SELECT 
        a.id as auth_id,
        (SELECT n.name FROM auth_names an JOIN names n ON an.name_id = n.id WHERE an.auth_id = a.id LIMIT 1) as name,
        COALESCE((SELECT d.description FROM auth_descriptions ad JOIN descriptions d ON ad.description_id = d.id WHERE ad.auth_id = a.id LIMIT 1), '') as description,
        (SELECT s.value FROM auth_slugs as_j JOIN slugs s ON s.id = as_j.slug_id WHERE as_j.auth_id = a.id LIMIT 1) as slug,
        EXISTS (SELECT 1 FROM auth_flags af JOIN flags fl ON af.flag_id = fl.id WHERE af.auth_id = a.id AND fl.name = 'active' AND af.type = 'active'::type_auth_flags AND af.value = TRUE) AS active,
        COALESCE(
            ARRAY_AGG(
                (ai.id, ai.name, COALESCE(ai.description, ''), ai.encrypted)::types.q_get_settings_detail_v4_auth_item
                ORDER BY ai.name
            ) FILTER (WHERE ai.id IS NOT NULL),
            '{}'::types.q_get_settings_detail_v4_auth_item[]
        ) as auth_items
    FROM setting s
    JOIN setting_auths sa ON sa.settings_id = s.id AND sa.active = true
    JOIN auths a ON a.id = sa.auth_id AND EXISTS (SELECT 1 FROM auth_flags af JOIN flags fl ON af.flag_id = fl.id WHERE af.auth_id = a.id AND fl.name = 'active' AND af.type = 'active'::type_auth_flags AND af.value = true)
    LEFT JOIN auth_items ai_j ON ai_j.auth_id = a.id
    LEFT JOIN items ai ON ai.id = ai_j.item_id
    WHERE s.id = (SELECT settings_id FROM params)
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
    -- Get linked providers for this settings (providers is now a resource table)
    SELECT 
        COALESCE(
            ARRAY_AGG(
                (p.id::text, n.name, COALESCE((SELECT d.description FROM provider_descriptions pd JOIN descriptions d ON pd.description_id = d.id WHERE pd.provider_id = pr.id LIMIT 1), ''), n.name, sp.active)::types.q_get_settings_detail_v4_provider
                ORDER BY n.name
            ),
            '{}'::types.q_get_settings_detail_v4_provider[]
        ) as providers,
        ARRAY_AGG(n.name ORDER BY n.name) as provider_ids
    FROM setting s
    JOIN setting_providers sp ON sp.settings_id = s.id AND sp.active = true
    JOIN providers p ON p.id = sp.providers_id
    JOIN provider pr ON pr.id = p.provider_id
    JOIN provider_names pn ON pn.provider_id = pr.id
    JOIN names n ON n.id = pn.name_id
    WHERE s.id = (SELECT settings_id FROM params)
),
all_providers_data AS (
    -- Get ALL providers (not just linked ones) - providers is now a resource table
    SELECT 
        COALESCE(
            ARRAY_AGG(
                (p.id::text, n.name, COALESCE((SELECT d.description FROM provider_descriptions pd JOIN descriptions d ON pd.description_id = d.id WHERE pd.provider_id = pr.id LIMIT 1), ''), n.name, true)::types.q_get_settings_detail_v4_provider
                ORDER BY n.name
            ),
            '{}'::types.q_get_settings_detail_v4_provider[]
        ) as all_providers
    FROM providers p
    JOIN provider pr ON pr.id = p.provider_id
    JOIN provider_names pn ON pn.provider_id = pr.id
    JOIN names n ON n.id = pn.name_id
    WHERE p.active = true
),
all_auths_with_items AS (
    -- Get ALL auths (not just linked ones) with nested auth_items
    SELECT 
        a.id as auth_id,
        (SELECT n.name FROM auth_names an JOIN names n ON an.name_id = n.id WHERE an.auth_id = a.id LIMIT 1) as name,
        COALESCE((SELECT d.description FROM auth_descriptions ad JOIN descriptions d ON ad.description_id = d.id WHERE ad.auth_id = a.id LIMIT 1), '') as description,
        (SELECT s.value FROM auth_slugs as_j JOIN slugs s ON s.id = as_j.slug_id WHERE as_j.auth_id = a.id LIMIT 1) as slug,
        EXISTS (SELECT 1 FROM auth_flags af JOIN flags fl ON af.flag_id = fl.id WHERE af.auth_id = a.id AND fl.name = 'active' AND af.type = 'active'::type_auth_flags AND af.value = TRUE) AS active,
        COALESCE(
            ARRAY_AGG(
                (ai.id, ai.name, COALESCE(ai.description, ''), ai.encrypted)::types.q_get_settings_detail_v4_auth_item
                ORDER BY ai.name
            ) FILTER (WHERE ai.id IS NOT NULL),
            '{}'::types.q_get_settings_detail_v4_auth_item[]
        ) as auth_items
    FROM auths a
    LEFT JOIN auth_items ai_j ON ai_j.auth_id = a.id
    LEFT JOIN items ai ON ai.id = ai_j.item_id
    WHERE EXISTS (SELECT 1 FROM auth_flags af JOIN flags fl ON af.flag_id = fl.id WHERE af.auth_id = a.id AND fl.name = 'active' AND af.type = 'active'::type_auth_flags AND af.value = true)
    GROUP BY a.id, (SELECT n.name FROM auth_names an JOIN names n ON an.name_id = n.id WHERE an.auth_id = a.id LIMIT 1), (SELECT d.description FROM auth_descriptions ad JOIN descriptions d ON ad.description_id = d.id WHERE ad.auth_id = a.id LIMIT 1), (SELECT s.value FROM auth_slugs as_j JOIN slugs s ON s.id = as_j.slug_id WHERE as_j.auth_id = a.id LIMIT 1), EXISTS (SELECT 1 FROM auth_flags af JOIN flags fl ON af.flag_id = fl.id WHERE af.auth_id = a.id AND fl.name = 'active' AND af.type = 'active'::type_auth_flags AND af.value = TRUE)
),
all_auths_data AS (
    -- Aggregate all auths into array
    SELECT 
        COALESCE(
            ARRAY_AGG(
                (aawi.auth_id, aawi.name, aawi.description, aawi.slug, aawi.active, aawi.auth_items)::types.q_get_settings_detail_v4_auth
                ORDER BY aawi.name
            ),
            '{}'::types.q_get_settings_detail_v4_auth[]
        ) as all_auths
    FROM all_auths_with_items aawi
),
settings_provider_keys_data AS (
    -- Get provider key mappings for this settings
    SELECT 
        COALESCE(
            ARRAY_AGG(
                (n.name, spk.key_id)::types.q_get_settings_detail_v4_provider_key
                ORDER BY n.name
            ),
            '{}'::types.q_get_settings_detail_v4_provider_key[]
        ) as provider_keys
    FROM setting_provider_keys spk
    JOIN providers p ON p.id = spk.providers_id
    JOIN provider pr ON pr.id = p.provider_id
    JOIN provider_names pn ON pn.provider_id = pr.id
    JOIN names n ON n.id = pn.name_id
    WHERE spk.settings_id = (SELECT settings_id FROM params) AND spk.active = true
),
settings_auth_keys_grouped AS (
    -- Get auth key mappings grouped by auth_id
    SELECT 
        sak.auth_id,
        COALESCE(
            ARRAY_AGG(
                (sak.auth_item_id, sak.key_id)::types.q_get_settings_detail_v4_auth_key_item
                ORDER BY sak.auth_item_id
            ) FILTER (WHERE sak.auth_item_id IS NOT NULL),
            '{}'::types.q_get_settings_detail_v4_auth_key_item[]
        ) as items
    FROM setting_auth_keys sak
    WHERE sak.settings_id = (SELECT settings_id FROM params) AND sak.active = true
    GROUP BY sak.auth_id
),
settings_auth_keys_data AS (
    -- Aggregate auth keys into array
    SELECT 
        COALESCE(
            ARRAY_AGG(
                (sakg.auth_id, sakg.items)::types.q_get_settings_detail_v4_auth_key
                ORDER BY sakg.auth_id
            ),
            '{}'::types.q_get_settings_detail_v4_auth_key[]
        ) as auth_keys
    FROM settings_auth_keys_grouped sakg
),
settings_auth_values_grouped AS (
    -- Get auth value mappings grouped by auth_id
    SELECT 
        sav.auth_id,
        COALESCE(
            ARRAY_AGG(
                (sav.auth_item_id, sav.value)::types.q_get_settings_detail_v4_auth_value_item
                ORDER BY sav.auth_item_id
            ) FILTER (WHERE sav.auth_item_id IS NOT NULL),
            '{}'::types.q_get_settings_detail_v4_auth_value_item[]
        ) as items
    FROM setting_auth_values sav
    WHERE sav.settings_id = (SELECT settings_id FROM params)
    GROUP BY sav.auth_id
),
settings_auth_values_data AS (
    -- Aggregate auth values into array
    SELECT 
        COALESCE(
            ARRAY_AGG(
                (savg.auth_id, savg.items)::types.q_get_settings_detail_v4_auth_value
                ORDER BY savg.auth_id
            ),
            '{}'::types.q_get_settings_detail_v4_auth_value[]
        ) as auth_values
    FROM settings_auth_values_grouped savg
),
user_departments AS (
    SELECT department_id
    FROM params x
    JOIN profile_departments ON profile_departments.profile_id = x.profile_id AND profile_departments.active = true
),
user_profile_role AS (
    SELECT role
    FROM params x
    JOIN profile ON profile.id = x.profile_id
),
-- Get department_ids via setting_provider_keys -> settings -> department_settings
key_departments_data AS (
    SELECT 
        spk.key_id,
        ARRAY_AGG(DISTINCT ds.department_id::text ORDER BY ds.department_id::text) as department_ids
    FROM setting_provider_keys spk
    JOIN setting s ON s.id = spk.settings_id AND EXISTS (SELECT 1 FROM scenario_flags sf JOIN flags fl ON sf.flag_id = fl.id WHERE sf.scenario_id = s.id AND fl.name = 'active' AND sf.type = 'active'::type_scenario_flags AND sf.value = true)
    JOIN department_settings ds ON ds.settings_id = s.id AND ds.active = true
    WHERE spk.active = true
    GROUP BY spk.key_id
),
settings_keys_data AS (
    -- Get all keys accessible to user (similar to keys/list logic)
    SELECT 
        COALESCE(
            ARRAY_AGG(
                (k.id, 
                 (SELECT n.name FROM key_names kn JOIN names n ON kn.name_id = n.id WHERE kn.key_id = k.id LIMIT 1),
                 CASE 
                     WHEN LENGTH(k.key) > 4 THEN LEFT(k.key, 4) || '****'
                     ELSE '****'
                 END,
                 COALESCE((SELECT d.description FROM key_descriptions kd JOIN descriptions d ON kd.description_id = d.id WHERE kd.key_id = k.id LIMIT 1), ''),
                 EXISTS (SELECT 1 FROM key_flags kf JOIN flags fl ON kf.flag_id = fl.id WHERE kf.key_id = k.id AND fl.name = 'active' AND kf.type = 'active'::type_key_flags AND kf.value = TRUE),
                 kdd.department_ids
                )::types.q_get_settings_detail_v4_key
                ORDER BY k.created_at DESC
            ),
            '{}'::types.q_get_settings_detail_v4_key[]
        ) as keys
    FROM key k
    LEFT JOIN key_departments_data kdd ON kdd.key_id = k.id
    CROSS JOIN user_profile_role upr
    WHERE 
        -- Include keys with matching department links OR default keys (no department links) OR superadmin can see all
        EXISTS (
            SELECT 1 FROM setting_provider_keys spk
            JOIN setting s ON s.id = spk.settings_id AND EXISTS (SELECT 1 FROM scenario_flags sf JOIN flags fl ON sf.flag_id = fl.id WHERE sf.scenario_id = s.id AND fl.name = 'active' AND sf.type = 'active'::type_scenario_flags AND sf.value = true)
            JOIN department_settings ds ON ds.settings_id = s.id AND ds.active = true
            JOIN user_departments ud ON ud.department_id = ds.department_id
            WHERE spk.key_id = k.id AND spk.active = true
        )
        OR NOT EXISTS (SELECT 1 FROM key_departments_data kdd2 WHERE kdd2.key_id = k.id)
        OR upr.role = 'superadmin'
),
settings_default_account_data AS (
    -- Get default admin/superadmin account for this settings
    SELECT 
        sda.profile_id as default_admin_profile_id,
        COALESCE((SELECT n.name FROM profile_names pn JOIN names n ON pn.name_id = n.id WHERE pn.profile_id = p.id AND pn.type = 'first' LIMIT 1) || ' ' || (SELECT n2.name FROM profile_names pn2 JOIN names n2 ON pn2.name_id = n2.id WHERE pn2.profile_id = p.id AND pn2.type = 'last' LIMIT 1), '') as default_admin_name
    FROM settings_default_account sda
    JOIN profile p ON p.id = sda.profile_id
    WHERE sda.settings_id = (SELECT settings_id FROM params) AND sda.active = true
    LIMIT 1
),
settings_default_guest_data AS (
    -- Get default guest account for this settings
    SELECT 
        sdg.profile_id as default_guest_profile_id,
        COALESCE((SELECT n.name FROM profile_names pn JOIN names n ON pn.name_id = n.id WHERE pn.profile_id = p.id AND pn.type = 'first' LIMIT 1) || ' ' || (SELECT n2.name FROM profile_names pn2 JOIN names n2 ON pn2.name_id = n2.id WHERE pn2.profile_id = p.id AND pn2.type = 'last' LIMIT 1), '') as default_guest_name
    FROM settings_default_guest sdg
    JOIN profile p ON p.id = sdg.profile_id
    WHERE sdg.settings_id = (SELECT settings_id FROM params) AND sdg.active = true
    LIMIT 1
),
settings_departments_data AS (
    -- Get linked departments for this settings
    SELECT 
        ARRAY_AGG(ds.department_id::text ORDER BY ds.created_at) as department_ids
    FROM department_settings ds
    WHERE ds.settings_id = (SELECT settings_id FROM params) AND ds.active = true
)
SELECT 
    sec.settings_exists::boolean as settings_exists,
    s.id as settings_id,
    s.created_at,
    -- Merge draft payload over existing settings data if draft_id provided
    COALESCE(
        (SELECT payload->>'active' FROM draft_payload_data),
        EXISTS (SELECT 1 FROM setting_flags sf JOIN flags fl ON sf.flag_id = fl.id WHERE sf.setting_id = s.id AND fl.name = 'active' AND sf.type = 'active'::type_setting_flags AND sf.value = TRUE)::text,
        'true'
    )::boolean as active,
    COALESCE(
        (SELECT payload->>'name' FROM draft_payload_data),
        (SELECT n.name FROM setting_names sn JOIN names n ON sn.name_id = n.id WHERE sn.setting_id = s.id LIMIT 1),
        ''
    ) as name,
    COALESCE(
        (SELECT payload->>'description' FROM draft_payload_data),
        (SELECT d.description FROM setting_descriptions sd JOIN descriptions d ON sd.description_id = d.id WHERE sd.setting_id = s.id LIMIT 1),
        ''
    ) as description,
    COALESCE(
        (SELECT payload->>'primary_color' FROM draft_payload_data),
        (SELECT payload->>'primaryColor' FROM draft_payload_data),
        (SELECT c.hex_code FROM setting_colors sc JOIN colors c ON sc.color_id = c.id WHERE sc.setting_id = s.id AND sc.type = 'primary'::type_setting_colors LIMIT 1),
        '#171717'
    ) as primary_color,
    COALESCE(
        (SELECT payload->>'accent' FROM draft_payload_data),
        (SELECT c.hex_code FROM setting_colors sc JOIN colors c ON sc.color_id = c.id WHERE sc.setting_id = s.id AND sc.type = 'accent'::type_setting_colors LIMIT 1),
        '#f5f5f5'
    ) as accent,
    COALESCE(
        (SELECT payload->>'background' FROM draft_payload_data),
        (SELECT c.hex_code FROM setting_colors sc JOIN colors c ON sc.color_id = c.id WHERE sc.setting_id = s.id AND sc.type = 'background'::type_setting_colors LIMIT 1),
        '#ffffff'
    ) as background,
    COALESCE(
        (SELECT payload->>'surface' FROM draft_payload_data),
        (SELECT c.hex_code FROM setting_colors sc JOIN colors c ON sc.color_id = c.id WHERE sc.setting_id = s.id AND sc.type = 'surface'::type_setting_colors LIMIT 1),
        '#ffffff'
    ) as surface,
    COALESCE(
        (SELECT payload->>'success' FROM draft_payload_data),
        (SELECT c.hex_code FROM setting_colors sc JOIN colors c ON sc.color_id = c.id WHERE sc.setting_id = s.id AND sc.type = 'success'::type_setting_colors LIMIT 1),
        '#009e34'
    ) as success,
    COALESCE(
        (SELECT payload->>'warning' FROM draft_payload_data),
        (SELECT c.hex_code FROM setting_colors sc JOIN colors c ON sc.color_id = c.id WHERE sc.setting_id = s.id AND sc.type = 'warning'::type_setting_colors LIMIT 1),
        '#ea8100'
    ) as warning,
    COALESCE(
        (SELECT payload->>'error' FROM draft_payload_data),
        (SELECT c.hex_code FROM setting_colors sc JOIN colors c ON sc.color_id = c.id WHERE sc.setting_id = s.id AND sc.type = 'error'::type_setting_colors LIMIT 1),
        '#e7000b'
    ) as error,
    COALESCE(
        (SELECT payload->>'sidebar_background' FROM draft_payload_data),
        (SELECT payload->>'sidebarBackground' FROM draft_payload_data),
        (SELECT c.hex_code FROM setting_colors sc JOIN colors c ON sc.color_id = c.id WHERE sc.setting_id = s.id AND sc.type = 'sidebar_background'::type_setting_colors LIMIT 1),
        '#fafafa'
    ) as sidebar_background,
    COALESCE(
        (SELECT payload->>'sidebar_primary' FROM draft_payload_data),
        (SELECT payload->>'sidebarPrimary' FROM draft_payload_data),
        (SELECT c.hex_code FROM setting_colors sc JOIN colors c ON sc.color_id = c.id WHERE sc.setting_id = s.id AND sc.type = 'sidebar_primary'::type_setting_colors LIMIT 1),
        '#171717'
    ) as sidebar_primary,
    COALESCE(
        (SELECT payload->>'chart1' FROM draft_payload_data),
        (SELECT c.hex_code FROM setting_colors sc JOIN colors c ON sc.color_id = c.id WHERE sc.setting_id = s.id AND sc.type = 'chart1'::type_setting_colors LIMIT 1),
        '#f54900'
    ) as chart1,
    COALESCE(
        (SELECT payload->>'chart2' FROM draft_payload_data),
        (SELECT c.hex_code FROM setting_colors sc JOIN colors c ON sc.color_id = c.id WHERE sc.setting_id = s.id AND sc.type = 'chart2'::type_setting_colors LIMIT 1),
        '#009689'
    ) as chart2,
    COALESCE(
        (SELECT payload->>'chart3' FROM draft_payload_data),
        (SELECT c.hex_code FROM setting_colors sc JOIN colors c ON sc.color_id = c.id WHERE sc.setting_id = s.id AND sc.type = 'chart3'::type_setting_colors LIMIT 1),
        '#104e64'
    ) as chart3,
    COALESCE(
        (SELECT payload->>'chart4' FROM draft_payload_data),
        (SELECT c.hex_code FROM setting_colors sc JOIN colors c ON sc.color_id = c.id WHERE sc.setting_id = s.id AND sc.type = 'chart4'::type_setting_colors LIMIT 1),
        '#ffb900'
    ) as chart4,
    COALESCE(
        (SELECT payload->>'chart5' FROM draft_payload_data),
        (SELECT c.hex_code FROM setting_colors sc JOIN colors c ON sc.color_id = c.id WHERE sc.setting_id = s.id AND sc.type = 'chart5'::type_setting_colors LIMIT 1),
        '#fe9a00'
    ) as chart5,
    COALESCE(
        (SELECT (payload->>'guest_login_enabled')::boolean FROM draft_payload_data),
        (SELECT (payload->>'guestLoginEnabled')::boolean FROM draft_payload_data),
        EXISTS (SELECT 1 FROM setting_flags sf JOIN flags fl ON sf.flag_id = fl.id WHERE sf.setting_id = s.id AND fl.name = 'guest_login_enabled' AND sf.type = 'guest_login_enabled'::type_setting_flags AND sf.value = TRUE),
        true
    ) as guest_login_enabled,
    COALESCE(
        (SELECT (payload->>'success_threshold')::integer FROM draft_payload_data),
        (SELECT (payload->>'successThreshold')::integer FROM draft_payload_data),
        (SELECT p.value FROM setting_thresholds st JOIN thresholds p ON st.threshold_id = p.id WHERE st.setting_id = s.id AND st.type = 'success'::type_setting_thresholds LIMIT 1),
        85
    ) as success_threshold,
    COALESCE(
        (SELECT (payload->>'warning_threshold')::integer FROM draft_payload_data),
        (SELECT (payload->>'warningThreshold')::integer FROM draft_payload_data),
        (SELECT p.value FROM setting_thresholds st JOIN thresholds p ON st.threshold_id = p.id WHERE st.setting_id = s.id AND st.type = 'warning'::type_setting_thresholds LIMIT 1),
        80
    ) as warning_threshold,
    COALESCE(
        (SELECT (payload->>'danger_threshold')::integer FROM draft_payload_data),
        (SELECT (payload->>'dangerThreshold')::integer FROM draft_payload_data),
        (SELECT p.value FROM setting_thresholds st JOIN thresholds p ON st.threshold_id = p.id WHERE st.setting_id = s.id AND st.type = 'danger'::type_setting_thresholds LIMIT 1),
        70
    ) as danger_threshold,
    COALESCE(sad.auth_ids, ARRAY[]::text[]) as auth_ids,
    COALESCE(sad.auths, '{}'::types.q_get_settings_detail_v4_auth[]) as auths,
    COALESCE(spd.provider_ids, ARRAY[]::text[]) as provider_ids,
    COALESCE(spd.providers, '{}'::types.q_get_settings_detail_v4_provider[]) as providers,
    COALESCE(spkd.provider_keys, '{}'::types.q_get_settings_detail_v4_provider_key[]) as provider_keys,
    COALESCE(sakd.auth_keys, '{}'::types.q_get_settings_detail_v4_auth_key[]) as auth_keys,
    COALESCE(savd.auth_values, '{}'::types.q_get_settings_detail_v4_auth_value[]) as auth_values,
    COALESCE(skd.keys, '{}'::types.q_get_settings_detail_v4_key[]) as keys,
    COALESCE(apd.all_providers, '{}'::types.q_get_settings_detail_v4_provider[]) as all_providers,
    COALESCE(aad.all_auths, '{}'::types.q_get_settings_detail_v4_auth[]) as all_auths,
    COALESCE(
        (SELECT (payload->>'default_admin_profile_id')::uuid FROM draft_payload_data),
        (SELECT (payload->>'defaultAdminProfileId')::uuid FROM draft_payload_data),
        sdad.default_admin_profile_id
    ) as default_admin_profile_id,
    sdad.default_admin_name,
    COALESCE(
        (SELECT (payload->>'default_guest_profile_id')::uuid FROM draft_payload_data),
        (SELECT (payload->>'defaultGuestProfileId')::uuid FROM draft_payload_data),
        sdgd.default_guest_profile_id
    ) as default_guest_profile_id,
    sdgd.default_guest_name,
    COALESCE(
        CASE 
            WHEN (SELECT payload->'department_ids' FROM draft_payload_data) IS NOT NULL AND jsonb_typeof((SELECT payload->'department_ids' FROM draft_payload_data)) = 'array' THEN
                ARRAY(SELECT jsonb_array_elements_text((SELECT payload->'department_ids' FROM draft_payload_data)))
            WHEN (SELECT payload->'departmentIds' FROM draft_payload_data) IS NOT NULL AND jsonb_typeof((SELECT payload->'departmentIds' FROM draft_payload_data)) = 'array' THEN
                ARRAY(SELECT jsonb_array_elements_text((SELECT payload->'departmentIds' FROM draft_payload_data)))
            ELSE NULL
        END,
        COALESCE(sdd.department_ids, ARRAY[]::text[])
    ) as department_ids,
    up.actor_name,
    COALESCE((SELECT draft_version FROM draft_payload_data), 0) as draft_version,
    -- Extract draft mappings (support both camelCase and snake_case)
    COALESCE(
        (SELECT payload->'provider_key_mapping' FROM draft_payload_data),
        (SELECT payload->'providerKeyMapping' FROM draft_payload_data),
        '{}'::jsonb
    ) as provider_key_mapping,
    COALESCE(
        (SELECT payload->'auth_key_mapping' FROM draft_payload_data),
        (SELECT payload->'authKeyMapping' FROM draft_payload_data),
        '{}'::jsonb
    ) as auth_key_mapping,
    COALESCE(
        (SELECT payload->'provider_enabled' FROM draft_payload_data),
        (SELECT payload->'providerEnabled' FROM draft_payload_data),
        '{}'::jsonb
    ) as provider_enabled,
    COALESCE(
        (SELECT payload->'auth_enabled' FROM draft_payload_data),
        (SELECT payload->'authEnabled' FROM draft_payload_data),
        '{}'::jsonb
    ) as auth_enabled,
    COALESCE(
        (SELECT payload->'auth_value_mapping' FROM draft_payload_data),
        (SELECT payload->'authValueMapping' FROM draft_payload_data),
        '{}'::jsonb
    ) as auth_value_mapping
FROM settings_exists_check sec
CROSS JOIN params p
LEFT JOIN setting s ON s.id = p.settings_id
LEFT JOIN settings_auths_data sad ON true
LEFT JOIN settings_providers_data spd ON true
LEFT JOIN settings_provider_keys_data spkd ON true
LEFT JOIN settings_auth_keys_data sakd ON true
LEFT JOIN settings_auth_values_data savd ON true
LEFT JOIN settings_keys_data skd ON true
LEFT JOIN all_providers_data apd ON true
LEFT JOIN all_auths_data aad ON true
LEFT JOIN settings_default_account_data sdad ON true
LEFT JOIN settings_default_guest_data sdgd ON true
LEFT JOIN settings_departments_data sdd ON true
CROSS JOIN user_profile up
$$;