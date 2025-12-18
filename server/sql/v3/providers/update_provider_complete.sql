-- Update provider with optional endpoint in a single transaction
-- Parameters: $1=provider_id, $2=name, $3=description, $4=value, $5=active, $6=base_url (text, nullable), $7=profile_id (uuid)
WITH actor_profile AS (
    SELECT 
        $7::uuid as profile_id,
        p.first_name || ' ' || p.last_name as actor_name
    FROM profiles p
    WHERE p.id = $7::uuid
),
update_provider AS (
    UPDATE providers
    SET 
        name = $2,
        description = $3,
        value = $4,
        active = $5,
        updated_at = NOW()
    WHERE id = $1::uuid
    RETURNING id::text as provider_id
),
update_endpoint AS (
    -- Update or create endpoint if base_url provided
    INSERT INTO provider_endpoints (provider_id, base_url, active, created_at, updated_at)
    SELECT 
        $1::uuid,
        $6::text,
        true,
        NOW(),
        NOW()
    WHERE $6::text IS NOT NULL AND TRIM($6::text) != ''
    ON CONFLICT (provider_id) DO UPDATE SET
        base_url = EXCLUDED.base_url,
        active = true,
        updated_at = NOW()
),
delete_endpoint AS (
    -- Delete endpoint if base_url is empty/null
    UPDATE provider_endpoints
    SET active = false, updated_at = NOW()
    WHERE provider_id = $1::uuid
    AND ($6::text IS NULL OR TRIM($6::text) = '')
)
SELECT 
    up.provider_id,
    ap.actor_name
FROM update_provider up
CROSS JOIN actor_profile ap

