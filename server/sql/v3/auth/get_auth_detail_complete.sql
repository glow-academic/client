-- Get auth detail with items and values
WITH auth_id_resolved AS (
    SELECT $1::uuid as auth_id
),
resolve_profile_id AS (
    SELECT 
        CASE 
            WHEN $2::text = 'guest-profile-id' THEN
                (SELECT id::uuid FROM profiles WHERE role = 'guest' AND default_profile = true ORDER BY created_at DESC LIMIT 1)
            ELSE $2::uuid
        END as resolved_profile_id
),
user_profile AS (
    SELECT p.role
    FROM resolve_profile_id rpi
    JOIN profiles p ON p.id = rpi.resolved_profile_id
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
    SELECT 
        ai.id as auth_item_id,
        ai.name,
        ai.description,
        CASE 
            WHEN LENGTH(ai.value) > 4 THEN LEFT(ai.value, 4) || '****'
            ELSE '****'
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
                'value_masked', value_masked
            )
            ORDER BY name
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

