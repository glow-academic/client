-- Create auth with items (encrypted items use keys, values managed separately in settings)
-- Parameters: $1=name, $2=description, $3=active, $4=items_json (jsonb array), $5=profile_id (uuid or "guest-profile-id")
-- items_json format: [{"name": "Item 1", "description": "Desc 1", "encrypted": true, "key_id": "uuid", "position": 1, "active": true}, ...]
-- For encrypted items: key_id can be provided to link keys
-- Values are managed separately in settings page, not included here
-- Returns: auth_id, actor_name
WITH resolve_guest_profile AS (
    -- Resolve guest-profile-id using settings system (department-specific or default)
    SELECT 
        COALESCE(
            -- Department-specific settings guest profile (if user has departments)
            (SELECT sdg.profile_id FROM settings_default_guest sdg
             JOIN settings s ON s.id = sdg.settings_id AND s.active = true
             JOIN department_settings sd ON sd.settings_id = s.id AND sd.active = true
             JOIN profile_departments pd ON pd.department_id = sd.department_id AND pd.active = true
             WHERE pd.profile_id = $5::uuid AND sdg.active = true
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
            WHEN $5::text = 'guest-profile-id' THEN
                (SELECT guest_profile_id FROM resolve_guest_profile)
            WHEN $5::text IS NULL OR $5::text = '' THEN NULL::uuid
            ELSE $5::uuid
        END as resolved_profile_id
),
actor_profile AS (
    SELECT 
        rpi.resolved_profile_id,
        p.first_name || ' ' || p.last_name as actor_name
    FROM resolve_profile_id rpi
    JOIN profiles p ON p.id = rpi.resolved_profile_id
),
new_auth AS (
    INSERT INTO auth (
        name,
        description,
        active
    )
    VALUES ($1, $2, $3)
    RETURNING id::text as auth_id
),
items_expanded AS (
    -- Expand JSONB items array
    SELECT 
        (item->>'name')::text as item_name,
        (item->>'description')::text as item_description,
        (item->>'key_id')::text as item_key_id,
        COALESCE((item->>'encrypted')::boolean, true) as item_encrypted,
        COALESCE((item->>'position')::int, ordinality) as item_position,
        COALESCE((item->>'active')::boolean, true) as item_active,
        ordinality as item_order
    FROM jsonb_array_elements(COALESCE($4::jsonb, '[]'::jsonb)) WITH ORDINALITY AS t(item, ordinality)
    WHERE COALESCE(jsonb_array_length(COALESCE($4::jsonb, '[]'::jsonb)), 0) > 0
),
new_items AS (
    -- Create all auth items (without value column - dropped in migration)
    INSERT INTO auth_items (
        auth_id,
        name,
        description,
        encrypted,
        position,
        active
    )
    SELECT 
        na.auth_id::uuid,
        ie.item_name,
        ie.item_description,
        ie.item_encrypted,
        ie.item_position,
        ie.item_active
    FROM new_auth na
    CROSS JOIN items_expanded ie
    RETURNING id::text as item_id, encrypted
),
link_encrypted_keys AS (
    -- Link encrypted items to keys via auth_item_keys
    INSERT INTO auth_item_keys (auth_item_id, key_id, active, created_at, updated_at)
    SELECT 
        ni.item_id::uuid,
        ie.item_key_id::uuid,
        true,
        NOW(),
        NOW()
    FROM new_items ni
    JOIN items_expanded ie ON ni.encrypted = ie.item_encrypted
    WHERE ni.encrypted = true 
      AND ie.item_key_id IS NOT NULL 
      AND ie.item_key_id != ''
    ON CONFLICT (auth_item_id, key_id) DO UPDATE SET
        active = true,
        updated_at = NOW()
)
SELECT 
    na.auth_id,
    ap.actor_name
FROM new_auth na
CROSS JOIN actor_profile ap

