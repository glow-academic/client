-- Get default auth detail for creation mode
WITH resolve_profile_id AS (
    SELECT 
        CASE 
            WHEN $1::text = 'guest-profile-id' THEN
                (SELECT id::uuid FROM profiles WHERE role = 'guest' AND default_profile = true ORDER BY created_at DESC LIMIT 1)
            ELSE $1::uuid
        END as resolved_profile_id
),
user_profile AS (
    SELECT p.role
    FROM resolve_profile_id rpi
    JOIN profiles p ON p.id = rpi.resolved_profile_id
),
auth_data AS (
    SELECT 
        '' as name,
        '' as description,
        false as active,
        up.role as user_role
    FROM user_profile up
),
items_json AS (
    SELECT '[]'::jsonb as items
),
key_mapping_data AS (
    SELECT COALESCE(
        jsonb_object_agg(
            k.id::text,
            jsonb_build_object(
                'name', k.name,
                'description', CASE 
                    WHEN LENGTH(k.key) > 4 THEN LEFT(k.key, 4) || '****'
                    ELSE '****'
                END,
                'key_masked', CASE 
                    WHEN LENGTH(k.key) > 4 THEN LEFT(k.key, 4) || '****'
                    ELSE '****'
                END,
                'active', k.active
            )
        ) FILTER (WHERE k.id IS NOT NULL),
        '{}'::jsonb
    ) as mapping
    FROM keys k
    WHERE k.type = 'auth'
)
SELECT 
    ad.name,
    ad.description,
    ad.active,
    ad.user_role,
    ij.items as auth_items_json,
    kmd.mapping as key_mapping
FROM auth_data ad
CROSS JOIN items_json ij
CROSS JOIN key_mapping_data kmd

