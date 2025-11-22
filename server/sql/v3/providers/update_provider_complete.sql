-- Update provider with endpoint and API key in a single transaction
-- Parameters: $1=providerId, $2=name, $3=description, $4=api_key (encrypted, nullable), $5=base_url (nullable)
-- Returns: provider_id if updated, or no rows if provider doesn't exist
WITH provider_exists AS (
    -- Check if provider exists
    SELECT id, name
    FROM providers
    WHERE id = $1::uuid
),
update_provider AS (
    -- Update provider fields (name, description) if provider exists
    UPDATE providers SET
        name = $2,
        description = $3,
        updated_at = NOW()
    WHERE id IN (SELECT id FROM provider_exists)
    RETURNING id::text as provider_id
),
update_provider_key AS (
    -- Update API key for provider's models if api_key provided
    -- Get first model for this provider and update/create its key
    UPDATE model_keys mk
    SET key_id = (
        SELECT k.id FROM keys k
        WHERE k.key = $4::text AND k.type = 'api' AND k.active = true
        LIMIT 1
    )
    FROM models m
    WHERE m.provider_id = (SELECT id FROM provider_exists)
      AND mk.model_id = m.id
      AND mk.active = true
      AND $4::text IS NOT NULL
      AND COALESCE(TRIM($4::text), '') != ''
    LIMIT 1
),
upsert_endpoint AS (
    -- Upsert provider endpoint if base_url provided and provider exists
    INSERT INTO provider_endpoints (provider_id, base_url)
    SELECT 
        pe.id,
        $5::text
    FROM provider_exists pe
    WHERE $5::text IS NOT NULL AND COALESCE(TRIM($5::text), '') != ''
    ON CONFLICT (provider_id)
    DO UPDATE SET
        base_url = EXCLUDED.base_url,
        updated_at = NOW()
)
SELECT provider_id FROM update_provider

