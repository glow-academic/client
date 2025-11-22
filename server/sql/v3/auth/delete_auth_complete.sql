-- Delete auth entry (cascade will handle auth_items and auth_item_keys)
-- Parameters: $1=auth_id
WITH auth_to_delete AS (
    SELECT id, name
    FROM auth
    WHERE id = $1::uuid
)
DELETE FROM auth
WHERE id = (SELECT id FROM auth_to_delete)
RETURNING id::text as auth_id, name

