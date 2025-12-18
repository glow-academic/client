-- Delete provider (cascade deletes provider_endpoints, setting_provider_keys)
-- Parameters: $1=providerId (uuid), $2=profileId (uuid)
-- Returns: provider_id, name, actor_name if deletion successful
-- Prevents deletion if provider is used by models
WITH resolve_profile_id AS (
    SELECT 
        CASE 
            WHEN $2::text IS NULL OR $2::text = '' THEN NULL::uuid
            ELSE $2::uuid
        END as resolved_profile_id
),
actor_profile AS (
    SELECT 
        $2::uuid as profile_id,
        p.first_name || ' ' || p.last_name as actor_name
    FROM profiles p
    WHERE p.id = $2::uuid
),
provider_info AS (
    SELECT id, name FROM providers WHERE id = $1::uuid
),
user_profile AS (
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
    WHERE id = (SELECT id FROM provider_info)
    AND EXISTS (SELECT 1 FROM check_permissions WHERE can_delete = true)
    AND NOT EXISTS (SELECT 1 FROM check_usage WHERE is_used = true)
    RETURNING id
)
SELECT 
    (SELECT id::text FROM provider_info) as provider_id,
    (SELECT name FROM provider_info) as name,
    (SELECT actor_name FROM actor_profile) as actor_name
WHERE EXISTS (SELECT 1 FROM delete_provider)

