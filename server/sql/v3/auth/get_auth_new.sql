-- Get default auth detail for creation mode
WITH user_profile AS (
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
)
SELECT 
    ad.name,
    ad.description,
    ad.active,
    ad.user_role,
    ij.items as auth_items_json
FROM auth_data ad
CROSS JOIN items_json ij

