-- Update auth with items (encrypted items use keys, non-encrypted use values table)
-- Parameters: $1=auth_id, $2=name, $3=description, $4=active, $5=items_json (jsonb array)
-- items_json format: [{"name": "Item 1", "description": "Desc 1", "value": "value", "encrypted": true, "key_id": "uuid"}, ...]
-- For encrypted items: key_id must be provided, value is ignored
-- For non-encrypted items: value must be provided, key_id is ignored
WITH auth_id_resolved AS (
    SELECT $1::uuid as auth_id
),
delete_existing_keys AS (
    -- Delete all existing auth_item_keys links
    DELETE FROM auth_item_keys
    WHERE auth_item_id IN (
        SELECT id FROM auth_items WHERE auth_id = (SELECT auth_id FROM auth_id_resolved)
    )
),
delete_existing_values AS (
    -- Delete all existing auth_item_values
    DELETE FROM auth_item_values
    WHERE auth_item_id IN (
        SELECT id FROM auth_items WHERE auth_id = (SELECT auth_id FROM auth_id_resolved)
    )
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
        (item->>'value')::text as item_value,
        (item->>'key_id')::text as item_key_id,
        COALESCE((item->>'encrypted')::boolean, true) as item_encrypted,
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
        encrypted
    )
    SELECT 
        ua.auth_id::uuid,
        ie.item_name,
        ie.item_description,
        ie.item_encrypted
    FROM update_auth ua
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
),
store_non_encrypted_values AS (
    -- Store non-encrypted items in auth_item_values
    INSERT INTO auth_item_values (auth_item_id, value, created_at, updated_at)
    SELECT 
        ni.item_id::uuid,
        COALESCE(ie.item_value, ''),
        NOW(),
        NOW()
    FROM new_items ni
    JOIN items_expanded ie ON ni.encrypted = ie.item_encrypted
    WHERE ni.encrypted = false
    ON CONFLICT (auth_item_id) DO UPDATE SET
        value = EXCLUDED.value,
        updated_at = NOW()
)
SELECT auth_id FROM update_auth

