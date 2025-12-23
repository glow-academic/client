-- Create provider with optional endpoint in a single transaction
-- Parameters: $1=name, $2=description, $3=value, $4=active, $5=base_url (text, nullable), $6=profile_id (uuid, required)
-- Returns: provider_id, actor_name
-- profile_id is always a UUID (required in request body)
WITH actor_profile AS (
    SELECT 
        $6::uuid as resolved_profile_id,
        p.first_name || ' ' || p.last_name as actor_name
    FROM profiles p
    WHERE p.id = $6::uuid
),
new_provider AS (
    INSERT INTO providers (
        name,
        description,
        value,
        active
    )
    VALUES ($1, $2, $3, $4)
    RETURNING id::text as provider_id
),
link_endpoint AS (
    -- Link endpoint if base_url provided
    INSERT INTO provider_endpoints (provider_id, base_url, active, created_at, updated_at)
    SELECT 
        np.provider_id::uuid,
        $5::text,
        true,
        NOW(),
        NOW()
    FROM new_provider np
    WHERE $5::text IS NOT NULL AND TRIM($5::text) != ''
    ON CONFLICT (provider_id) DO UPDATE SET
        base_url = EXCLUDED.base_url,
        active = true,
        updated_at = NOW()
)
SELECT 
    np.provider_id,
    ap.actor_name
FROM new_provider np
CROSS JOIN actor_profile ap

