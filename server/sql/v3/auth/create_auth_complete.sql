-- Create auth with items and values in a single transaction
-- Parameters: $1=name, $2=description, $3=active, $4=items_json (jsonb array)
-- items_json format: [{"name": "Item 1", "description": "Desc 1", "value": "value", "encrypted": true}, ...]
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
        COALESCE((item->>'encrypted')::boolean, true) as item_encrypted,
        ordinality as item_order
    FROM jsonb_array_elements(COALESCE($4::jsonb, '[]'::jsonb)) WITH ORDINALITY AS t(item, ordinality)
    WHERE COALESCE(jsonb_array_length(COALESCE($4::jsonb, '[]'::jsonb)), 0) > 0
),
new_items AS (
    -- Create all auth items with values and encrypted flag
    INSERT INTO auth_items (
        auth_id,
        name,
        description,
        value,
        encrypted
    )
    SELECT 
        na.auth_id::uuid,
        ie.item_name,
        ie.item_description,
        COALESCE(ie.item_value, ''),
        ie.item_encrypted
    FROM new_auth na
    CROSS JOIN items_expanded ie
    RETURNING id::text as item_id
)
SELECT auth_id FROM new_auth

