-- Get provider detail with endpoint info and permissions
-- Parameters: $1=providerId (uuid), $2=profileId (uuid)
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
provider_data AS (
    SELECT 
        p.id::text as provider_id,
        p.name,
        p.description,
        p.value,
        p.active,
        p.created_at,
        p.updated_at,
        COALESCE(pe.base_url, '') as base_url
    FROM providers p
    LEFT JOIN provider_endpoints pe ON pe.provider_id = p.id AND pe.active = true
    WHERE p.id = $1::uuid
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
)
SELECT 
    pd.*,
    up.role as user_role,
    CASE 
        WHEN up.role IN ('admin', 'superadmin') THEN true
        ELSE false
    END as can_edit,
    CASE 
        WHEN cu.is_used THEN false
        WHEN up.role IN ('admin', 'superadmin') THEN true
        ELSE false
    END as can_delete,
    ap.actor_name
FROM provider_data pd
CROSS JOIN user_profile up
CROSS JOIN check_usage cu
CROSS JOIN actor_profile ap

