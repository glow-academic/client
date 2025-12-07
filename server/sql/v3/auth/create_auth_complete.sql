-- Create auth with items (encrypted items use keys, non-encrypted use values table)
-- Parameters: $1=name, $2=description, $3=active, $4=items_json (jsonb array)
-- items_json format: [{"name": "Item 1", "description": "Desc 1", "value": "value", "encrypted": true, "key_id": "uuid"}, ...]
-- For encrypted items: key_id must be provided, value is ignored
-- For non-encrypted items: value must be provided, key_id is ignored
WITH new_auth AS (
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
        (item->>'value')::text as item_value,
        (item->>'key_id')::text as item_key_id,
        COALESCE((item->>'encrypted')::boolean, true) as item_encrypted,
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
        encrypted
    )
    SELECT 
        na.auth_id::uuid,
        ie.item_name,
        ie.item_description,
        ie.item_encrypted
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
SELECT auth_id FROM new_auth

