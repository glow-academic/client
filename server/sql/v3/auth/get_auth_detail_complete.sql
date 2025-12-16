-- Get auth detail with items (values managed separately in settings)
WITH auth_id_resolved AS (
    SELECT $1::uuid as auth_id
),
user_profile AS (
    SELECT p.role
    FROM profiles p
    WHERE p.id = $2::uuid
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
auth_items_data AS (
    -- Get all auth items (values managed separately in settings page)
    SELECT 
        ai.id as auth_item_id,
        ai.name,
        ai.description,
        ai.position,
        ai.active,
        ai.encrypted,
        NULL::text as key_id,
        CASE 
            WHEN ai.encrypted THEN '****'
            ELSE ''::text
        END as value_masked
    FROM auth_id_resolved aid
    JOIN auth_items ai ON ai.auth_id = aid.auth_id
),
items_json AS (
    SELECT COALESCE(
        jsonb_agg(
            jsonb_build_object(
                'auth_item_id', auth_item_id::text,
                'name', name,
                'description', description,
                'position', position,
                'active', active,
                'value_masked', value_masked,
                'key_id', key_id,
                'encrypted', encrypted
            )
            ORDER BY position
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

