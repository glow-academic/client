-- Get auth detail with items and keys
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
auth_items_with_keys AS (
    SELECT 
        ai.id as auth_item_id,
        ai.name,
        ai.description,
        ARRAY_AGG(DISTINCT aik.key_id::text ORDER BY aik.key_id::text) FILTER (WHERE aik.key_id IS NOT NULL AND aik.active = true) as key_ids
    FROM auth_id_resolved aid
    JOIN auth_items ai ON ai.auth_id = aid.auth_id
    LEFT JOIN auth_item_keys aik ON aik.auth_item_id = ai.id AND aik.active = true
    GROUP BY ai.id, ai.name, ai.description
),
items_json AS (
    SELECT COALESCE(
        jsonb_agg(
            jsonb_build_object(
                'auth_item_id', auth_item_id::text,
                'name', name,
                'description', description,
                'key_ids', COALESCE(key_ids, ARRAY[]::text[])
            )
            ORDER BY name
        ),
        '[]'::jsonb
    ) as items
    FROM auth_items_with_keys
),
all_key_ids AS (
    SELECT DISTINCT unnest(key_ids)::uuid as key_id
    FROM auth_items_with_keys
    WHERE key_ids IS NOT NULL
),
key_mapping_data AS (
    SELECT COALESCE(
        jsonb_object_agg(
            k.id::text,
            jsonb_build_object(
                'key_masked', CASE 
                    WHEN LENGTH(k.key) > 4 THEN LEFT(k.key, 4) || '****'
                    ELSE '****'
                END,
                'active', k.active
            )
        ) FILTER (WHERE k.id IS NOT NULL),
        '{}'::jsonb
    ) as mapping
    FROM all_key_ids aki
    LEFT JOIN keys k ON k.id = aki.key_id AND k.type = 'auth'
)
SELECT 
    ad.*,
    ij.items as auth_items_json,
    kmd.mapping as key_mapping
FROM auth_data ad
CROSS JOIN items_json ij
CROSS JOIN key_mapping_data kmd

