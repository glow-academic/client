-- Get auth detail with items and values
WITH auth_id_resolved AS (
    SELECT $1::uuid as auth_id
),
resolve_guest_profile AS (
    -- Resolve guest-profile-id using settings system (department-specific or default)
    SELECT 
        COALESCE(
            -- Department-specific settings guest profile (if user has departments)
            (SELECT sdg.profile_id FROM settings_default_guest sdg
             JOIN settings s ON s.id = sdg.settings_id AND s.active = true
             JOIN department_settings sd ON sd.settings_id = s.id AND sd.active = true
             JOIN profile_departments pd ON pd.department_id = sd.department_id AND pd.active = true
             WHERE pd.profile_id = $2::uuid AND sdg.active = true
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
            WHEN $2::text = 'guest-profile-id' THEN
                (SELECT guest_profile_id FROM resolve_guest_profile)
            WHEN $2::text IS NULL OR $2::text = '' THEN NULL::uuid
            ELSE $2::uuid
        END as resolved_profile_id
),
user_profile AS (
    SELECT p.role
    FROM resolve_profile_id rpi
    JOIN profiles p ON p.id = rpi.resolved_profile_id
),
auth_data AS (
    SELECT 
        a.name,
        a.description,
        a.active,
        CASE 
            WHEN up.role IN ('admin', 'superadmin') THEN true
            ELSE false
        END as can_edit
    FROM auth_id_resolved aid
    JOIN auth a ON a.id = aid.auth_id
    CROSS JOIN user_profile up
),
auth_items_encrypted AS (
    -- Get encrypted items with key info
    SELECT 
        ai.id as auth_item_id,
        ai.name,
        ai.description,
        aik.key_id::text as key_id,
        CASE 
            WHEN LENGTH(k.key) > 4 THEN LEFT(k.key, 4) || '****'
            ELSE '****'
        END as value_masked,
        true as encrypted
    FROM auth_id_resolved aid
    JOIN auth_items ai ON ai.auth_id = aid.auth_id
    JOIN auth_item_keys aik ON aik.auth_item_id = ai.id AND aik.active = true
    JOIN keys k ON k.id = aik.key_id
    WHERE ai.encrypted = true
),
auth_items_non_encrypted AS (
    -- Get non-encrypted items with values
    SELECT 
        ai.id as auth_item_id,
        ai.name,
        ai.description,
        NULL::text as key_id,
        aiv.value as value_masked,
        false as encrypted
    FROM auth_id_resolved aid
    JOIN auth_items ai ON ai.auth_id = aid.auth_id
    JOIN auth_item_values aiv ON aiv.auth_item_id = ai.id
    WHERE ai.encrypted = false
),
auth_items_data AS (
    -- Combine encrypted and non-encrypted items
    SELECT * FROM auth_items_encrypted
    UNION ALL
    SELECT * FROM auth_items_non_encrypted
),
items_json AS (
    SELECT COALESCE(
        jsonb_agg(
            jsonb_build_object(
                'auth_item_id', auth_item_id::text,
                'name', name,
                'description', description,
                'value_masked', value_masked,
                'key_id', key_id,
                'encrypted', encrypted
            )
            ORDER BY name
        ),
        '[]'::jsonb
    ) as items
    FROM auth_items_data
)
SELECT 
    ad.*,
    ij.items as auth_items_json
FROM auth_data ad
CROSS JOIN items_json ij

