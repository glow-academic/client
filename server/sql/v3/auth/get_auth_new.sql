-- Get default auth detail for creation mode
-- Parameters: $1 = profile_id (uuid)
WITH resolve_profile_id AS (
    SELECT 
        CASE 
            WHEN $1::text IS NULL OR $1::text = '' THEN NULL::uuid
            ELSE $1::uuid
        END as resolved_profile_id
),
user_profile AS (
    SELECT 
        p.role,
        p.first_name || ' ' || p.last_name as actor_name
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
    ij.items as auth_items_json,
    up.actor_name
FROM auth_data ad
CROSS JOIN items_json ij
CROSS JOIN user_profile up

