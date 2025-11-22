-- Update auth with items and key links in a single transaction
-- Parameters: $1=auth_id, $2=name, $3=description, $4=active, $5=items_json (jsonb array)
-- items_json format: [{"name": "Item 1", "description": "Desc 1", "key_ids": ["key1", "key2"]}, ...]
WITH auth_id_resolved AS (
    SELECT $1::uuid as auth_id
),
delete_existing_items AS (
    -- Delete all existing auth items (cascade will handle auth_item_keys)
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
        CASE 
            WHEN item ? 'key_ids' 
                 AND item->'key_ids' IS NOT NULL 
                 AND item->'key_ids' != 'null'::jsonb
                 AND jsonb_typeof(item->'key_ids') = 'array'
                 AND jsonb_array_length(item->'key_ids') > 0
            THEN (
                SELECT COALESCE(array_agg(elem), ARRAY[]::text[])
                FROM jsonb_array_elements_text(item->'key_ids') AS elem
                WHERE elem != 'None' AND elem IS NOT NULL
            )
            ELSE ARRAY[]::text[]
        END as key_ids,
        ordinality as item_order
    FROM jsonb_array_elements(COALESCE($5::jsonb, '[]'::jsonb)) WITH ORDINALITY AS t(item, ordinality)
    WHERE COALESCE(jsonb_array_length(COALESCE($5::jsonb, '[]'::jsonb)), 0) > 0
),
new_items AS (
    -- Create all auth items
    INSERT INTO auth_items (
        auth_id,
        name,
        description
    )
    SELECT 
        ua.auth_id::uuid,
        ie.item_name,
        ie.item_description
    FROM update_auth ua
    CROSS JOIN items_expanded ie
    RETURNING id::text as item_id, name as item_name
),
new_items_with_order AS (
    -- Add row numbers to new items for matching
    SELECT 
        item_id,
        item_name,
        ROW_NUMBER() OVER (ORDER BY item_name) as item_row_num
    FROM new_items
),
items_with_keys AS (
    -- Match items with their key arrays using row number
    SELECT 
        ni.item_id,
        ie.key_ids
    FROM new_items_with_order ni
    JOIN items_expanded ie ON ie.item_order = ni.item_row_num
    WHERE ie.key_ids IS NOT NULL AND array_length(ie.key_ids, 1) > 0
),
link_keys AS (
    -- Link keys to items if provided
    INSERT INTO auth_item_keys (auth_item_id, key_id, active, created_at, updated_at)
    SELECT 
        iwk.item_id::uuid,
        key_id::uuid,
        true,
        NOW(),
        NOW()
    FROM items_with_keys iwk
    CROSS JOIN UNNEST(iwk.key_ids) as key_id
    ON CONFLICT (auth_item_id, key_id) DO UPDATE SET
        active = true,
        updated_at = NOW()
)
SELECT auth_id FROM update_auth

