-- Duplicate auth with items and key links in a single transaction
-- Parameters: $1=source_auth_id
WITH source_auth AS (
    SELECT id, name, description, active
    FROM auth
    WHERE id = $1::uuid
),
new_auth AS (
    INSERT INTO auth (
        name,
        description,
        active
    )
    SELECT 
        name || ' (Copy)',
        description,
        active
    FROM source_auth
    RETURNING id::text as auth_id
),
source_items AS (
    SELECT 
        ai.id as source_item_id,
        ai.name,
        ai.description,
        ARRAY_AGG(aik.key_id::text ORDER BY aik.key_id::text) FILTER (WHERE aik.key_id IS NOT NULL AND aik.active = true) as key_ids
    FROM source_auth sa
    JOIN auth_items ai ON ai.auth_id = sa.id
    LEFT JOIN auth_item_keys aik ON aik.auth_item_id = ai.id AND aik.active = true
    GROUP BY ai.id, ai.name, ai.description
),
new_items AS (
    INSERT INTO auth_items (
        auth_id,
        name,
        description
    )
    SELECT 
        na.auth_id::uuid,
        si.name,
        si.description
    FROM new_auth na
    CROSS JOIN source_items si
    RETURNING id::text as item_id, name as item_name
),
new_items_with_order AS (
    SELECT 
        item_id,
        item_name,
        ROW_NUMBER() OVER (ORDER BY item_name) as item_row_num
    FROM new_items
),
items_with_keys AS (
    SELECT 
        ni.item_id,
        si.key_ids
    FROM new_items_with_order ni
    JOIN source_items si ON si.name = ni.item_name
    WHERE si.key_ids IS NOT NULL AND array_length(si.key_ids, 1) > 0
),
link_keys AS (
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
SELECT auth_id FROM new_auth

