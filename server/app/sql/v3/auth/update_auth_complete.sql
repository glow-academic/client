-- Update auth with items (encrypted items use keys, values managed separately in settings)
-- Parameters: $1=auth_id, $2=name, $3=description, $4=active, $5=items_json (jsonb array), $6=profile_id (uuid)
-- items_json format: [{"name": "Item 1", "description": "Desc 1", "encrypted": true, "key_id": "uuid", "position": 1, "active": true}, ...]
-- For encrypted items: key_id can be provided to link keys
-- Values are managed separately in settings page, not included here
WITH actor_profile AS (
    SELECT 
        $6::uuid as profile_id,
        p.first_name || ' ' || p.last_name as actor_name
    FROM profiles p
    WHERE p.id = $6::uuid
),
auth_id_resolved AS (
    SELECT $1::uuid as auth_id
),
delete_existing_keys AS (
    -- NOTE: auth_item_keys table was removed in migration 74
    -- Keys are now linked through settings (setting_auth_keys, setting_provider_keys)
    -- This CTE is kept for compatibility but does nothing
    SELECT 1 WHERE false
),
delete_existing_values AS (
    -- NOTE: auth_item_values table was removed in migration 74
    -- Values are now managed through settings (setting_auth_values)
    -- This CTE is kept for compatibility but does nothing
    SELECT 1 WHERE false
),
delete_existing_items AS (
    -- Delete all existing auth items (cascade will handle keys/values)
    DELETE FROM auth_items
    WHERE auth_id = (SELECT auth_id FROM auth_id_resolved)
    RETURNING id
),
update_auth AS (
    -- Update auth entry
    UPDATE auth
    SET 
        name = $2,
        description = $3,
        active = $4,
        updated_at = NOW()
    WHERE id = (SELECT auth_id FROM auth_id_resolved)
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
    FROM jsonb_array_elements(COALESCE($5::jsonb, '[]'::jsonb)) WITH ORDINALITY AS t(item, ordinality)
    WHERE COALESCE(jsonb_array_length(COALESCE($5::jsonb, '[]'::jsonb)), 0) > 0
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
        ua.auth_id::uuid,
        ie.item_name,
        ie.item_description,
        ie.item_encrypted,
        ie.item_position,
        ie.item_active
    FROM update_auth ua
    CROSS JOIN items_expanded ie
    RETURNING id::text as item_id, encrypted
),
link_encrypted_keys AS (
    -- NOTE: auth_item_keys table was removed in migration 74
    -- Keys are now linked through settings (setting_auth_keys, setting_provider_keys)
    -- This CTE is kept for compatibility but does nothing
    SELECT 1 WHERE false
)
SELECT 
    ua.auth_id,
    ap.actor_name
FROM update_auth ua
CROSS JOIN actor_profile ap

