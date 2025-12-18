-- Get default provider structure for new provider creation
-- Parameters: $1=profileId (uuid)
WITH resolve_profile_id AS (
    SELECT 
        CASE 
            WHEN $1::text IS NULL OR $1::text = '' THEN NULL::uuid
            ELSE $1::uuid
        END as resolved_profile_id
),
actor_profile AS (
    SELECT 
        $1::uuid as profile_id,
        p.first_name || ' ' || p.last_name as actor_name
    FROM profiles p
    WHERE p.id = $1::uuid
),
user_profile AS (
    SELECT role as user_role FROM resolve_profile_id rpi
    JOIN profiles p ON p.id = rpi.resolved_profile_id
)
SELECT 
    '' as provider_id,
    '' as name,
    '' as description,
    '' as value,
    true as active,
    NOW() as created_at,
    NOW() as updated_at,
    '' as base_url,
    pr.user_role,
    CASE 
        WHEN pr.user_role IN ('admin', 'superadmin') THEN true
        ELSE false
    END as can_edit,
    CASE 
        WHEN pr.user_role IN ('admin', 'superadmin') THEN true
        ELSE false
    END as can_delete,
    ap.actor_name
FROM user_profile pr
CROSS JOIN actor_profile ap

