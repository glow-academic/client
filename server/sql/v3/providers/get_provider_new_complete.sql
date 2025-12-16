-- Get default provider structure for new provider creation
-- Parameters: $1=profileId (uuid)
WITH user_profile AS (
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
    END as can_delete
FROM user_profile pr

