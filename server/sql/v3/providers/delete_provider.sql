-- Delete provider (cascade deletes provider_endpoints, setting_provider_keys)
-- Parameters: $1=providerId (uuid), $2=profileId (uuid)
-- Returns: provider_id if deletion successful
-- Prevents deletion if provider is used by models
WITH user_profile AS (
    SELECT role FROM resolve_profile_id rpi
    JOIN profiles p ON p.id = rpi.resolved_profile_id
),
check_usage AS (
    -- Check if provider is used by models
    SELECT EXISTS(
        SELECT 1 FROM models m 
        WHERE m.provider_id = $1::uuid AND m.active = true
    ) as is_used
),
check_permissions AS (
    SELECT 
        CASE 
            WHEN cu.is_used THEN false
            WHEN up.role IN ('admin', 'superadmin') THEN true
            ELSE false
        END as can_delete
    FROM user_profile up
    CROSS JOIN check_usage cu
),
delete_provider AS (
    DELETE FROM providers
    WHERE id = $1::uuid
    AND EXISTS (SELECT 1 FROM check_permissions WHERE can_delete = true)
    AND NOT EXISTS (SELECT 1 FROM check_usage WHERE is_used = true)
    RETURNING id::text as provider_id
)
SELECT provider_id FROM delete_provider

