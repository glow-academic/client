-- Update auth with items and values in a single transaction
-- Parameters: $1=auth_id, $2=name, $3=description, $4=active, $5=items_json (jsonb array)
-- items_json format: [{"name": "Item 1", "description": "Desc 1", "value": "encrypted_value"}, ...]
WITH auth_id_resolved AS (
    SELECT $1::uuid as auth_id
),
delete_existing_items AS (
    -- Delete all existing auth items
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
        ordinality as item_order
    FROM jsonb_array_elements(COALESCE($5::jsonb, '[]'::jsonb)) WITH ORDINALITY AS t(item, ordinality)
    WHERE COALESCE(jsonb_array_length(COALESCE($5::jsonb, '[]'::jsonb)), 0) > 0
),
new_items AS (
    -- Create all auth items with encrypted values
    INSERT INTO auth_items (
        auth_id,
        name,
        description,
        value
    )
    SELECT 
        ua.auth_id::uuid,
        ie.item_name,
        ie.item_description,
        COALESCE(ie.item_value, '')
    FROM update_auth ua
    CROSS JOIN items_expanded ie
    RETURNING id::text as item_id
)
SELECT auth_id FROM update_auth

