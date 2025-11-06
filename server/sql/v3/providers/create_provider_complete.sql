-- Create provider with endpoint in a single transaction
-- Parameters: $1=name, $2=description, $3=api_key (encrypted), $4=base_url (nullable)
-- Returns: provider_id
WITH new_provider AS (
    INSERT INTO providers (
        name,
        description,
        api_key
    )
    VALUES (
        $1,
        $2,
        $3
    )
    RETURNING id::text as provider_id
),
link_endpoint AS (
    -- Insert provider endpoint if base_url provided
    INSERT INTO provider_endpoints (provider_id, base_url)
    SELECT 
        np.provider_id::uuid,
        $4
    FROM new_provider np
    WHERE $4 IS NOT NULL AND COALESCE(TRIM($4), '') != ''
    ON CONFLICT (provider_id)
    DO UPDATE SET
        base_url = EXCLUDED.base_url,
        updated_at = NOW()
)
SELECT provider_id FROM new_provider

